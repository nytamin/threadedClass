import { ChildProcess, fork } from 'child_process'
import { FakeProcess } from './fakeProcess'
import { ThreadedClassConfig, ThreadedClass } from './api'
import {
	MessageFromChild,
	MessageToChildConstr,
	MessageToChild,
	InstanceCallbackFunction,
	MessageType,
	MessageKillConstr,
	MessageInitConstr,
	InstanceCallbackInitFunction,
	InitProps,
	MessagePingConstr,
	DEFAULT_CHILD_FREEZE_TIME
} from './internalApi'
import { EventEmitter } from 'events'
import { isBrowser, nodeSupportsWorkerThreads, browserSupportsWebWorkers } from './lib'
import { forkWebWorker, WebWorkerProcess } from './webWorkers'
import { forkWorkerThread } from './workerThreads'

export class ThreadedClassManagerClass {

	private _internal: ThreadedClassManagerClassInternal
	constructor (internal: ThreadedClassManagerClassInternal) {
		this._internal = internal
	}
	/** Destroy a proxy class */
	public destroy (proxy: ThreadedClass<any>): Promise<void> {
		return this._internal.killProxy(proxy)
	}
	public destroyAll (): Promise<void> {
		return this._internal.killAllChildren()
	}
	public getThreadCount (): number {
		return this._internal.getChildrenCount()
	}
	public onEvent (proxy: ThreadedClass<any>, event: string, cb: Function) {
		const onEvent = (child: Child) => {
			let foundChild = Object.keys(child.instances).find((instanceId) => {
				const instance = child.instances[instanceId]
				return instance.proxy === proxy
			})
			if (foundChild) {
				cb()
			}
		}
		this._internal.on(event, onEvent)
		return {
			stop: () => {
				this._internal.removeListener(event, onEvent)
			}
		}
	}
	/**
	 * Restart the thread of the proxy instance
	 * @param proxy
	 * @param forceRestart If true, will kill the thread and restart it
	 */
	public restart (proxy: ThreadedClass<any>, forceRestart?: boolean): Promise<void> {
		return this._internal.restart(proxy, forceRestart)
	}
	/**
	 * Returns a description of what threading mode the library will use in the current context.
	 */
	public getThreadMode (): ThreadMode {

		if (isBrowser()) {
			if (browserSupportsWebWorkers()) {
				return ThreadMode.WEB_WORKER
			} else {
				return ThreadMode.NOT_SUPPORTED
			}
		} else {
			if (nodeSupportsWorkerThreads()) {
				return ThreadMode.WORKER_THREADS
			} else {
				return ThreadMode.CHILD_PROCESS
			}
		}
	}
}
/**
 * The Child represents a child process, in which the proxy-classes live and run
 */
export interface Child {
	readonly id: string
	readonly isNamed: boolean
	readonly pathToWorker: string
	process: ChildProcess
	usage: number
	instances: {[id: string]: ChildInstance}
	methods: {[id: string]: {
		resolve: (result: any) => void,
		reject: (error: any) => void
	}}
	alive: boolean
	isClosing: boolean
	config: ThreadedClassConfig

	cmdId: number
	queue: {[cmdId: string]: InstanceCallbackFunction}

	callbackId: number
	callbacks: {[key: string]: Function}
}
export function childName (child: Child) {
	return `Child_ ${Object.keys(child.instances).join(',')}`
}
/**
 * The ChildInstance represents a proxy-instance of a class, running in a child process
 */
export interface ChildInstance {
	readonly id: string
	readonly proxy: ThreadedClass<any>
	readonly usage?: number
	/** When to consider the process is frozen */
	readonly freezeLimit?: number
	readonly onMessageCallback: (instance: ChildInstance, message: MessageFromChild) => void
	readonly pathToModule: string
	readonly className: string
	readonly classFunction: Function // used in single-threaded mode
	readonly constructorArgs: any[]
	readonly config: ThreadedClassConfig
	initialized: boolean
	child: Child
}
export class ThreadedClassManagerClassInternal extends EventEmitter {

	/** Set to true if you want to handle the exiting of child process yourselt */
	public dontHandleExit: boolean = false
	private isInitialized: boolean = false
	private _threadId: number = 0
	private _instanceId: number = 0
	private _methodId: number = 0
	private _children: {[id: string]: Child} = {}
	private _pinging: boolean = true // for testing only

	public getChild (
		config: ThreadedClassConfig,
		pathToWorker: string
	): Child {
		this._init()

		let child: Child | null = null
		if (config.threadId) {
			child = this._children[config.threadId] || null
		} else if (config.threadUsage) {
			child = this._findFreeChild(config.threadUsage)
		}
		if (!child) {
			// Create new child process:
			const newChild: Child = {
				id: config.threadId || ('process_' + this._threadId++),
				isNamed: !!config.threadId,
				pathToWorker: pathToWorker,

				process: this._createFork(config, pathToWorker),
				usage: config.threadUsage || 1,
				instances: {},
				methods: {},
				alive: true,
				isClosing: false,
				config,

				cmdId: 0,
				queue: {},
				callbackId: 0,
				callbacks: {}
			}
			this._setupChildProcess(newChild)
			this._children[newChild.id] = newChild
			child = newChild
		}

		return child
	}
	/**
	 * Attach a proxy-instance to a child
	 * @param child
	 * @param proxy
	 * @param onMessage
	 */
	public attachInstance (
		config: ThreadedClassConfig,
		child: Child,
		proxy: ThreadedClass<any>,
		pathToModule: string,
		className: string,
		classFunction: Function,
		constructorArgs: any[],
		onMessage: (instance: ChildInstance, message: MessageFromChild) => void
	): ChildInstance {
		const instance: ChildInstance = {

			id: 'instance_' + this._instanceId++ + (config.instanceName ? '_' + config.instanceName : ''),
			child: child,
			proxy: proxy,
			usage: config.threadUsage,
			freezeLimit: config.freezeLimit,
			onMessageCallback: onMessage,
			pathToModule: pathToModule,
			className: className,
			classFunction: classFunction,
			constructorArgs: constructorArgs,
			initialized: false,
			config: config
		}
		child.instances[instance.id] = instance

		return instance
	}
	public killProxy (proxy: ThreadedClass<any>): Promise<void> {

		return new Promise((resolve, reject) => {
			let foundProxy = false
			Object.keys(this._children).find((childId) => {
				const child = this._children[childId]

				const instanceId = Object.keys(child.instances).find((instanceId) => {
					let instance = child.instances[instanceId]

					return (instance.proxy === proxy)
				})
				if (instanceId) {
					let instance = child.instances[instanceId]
					foundProxy = true

					if (Object.keys(child.instances).length === 1) {
						// if there is only one instance left, we can kill the child
						this.killChild(childId)
						.then(resolve)
						.catch(reject)

					} else {
						const cleanup = () => {
							delete instance.child
							delete child.instances[instanceId]
						}
						this.sendMessageToChild(instance, {
							cmd: MessageType.KILL
						} as MessageKillConstr, () => {
							cleanup()
							resolve()
						})
						setTimeout(() => {
							cleanup()
							reject('Timeout: Kill child instance')
						},1000)
						if (instance.usage) {
							child.usage -= instance.usage
						}
					}

					return true
				}
				return false
			})
			if (!foundProxy) {
				reject('Proxy not found')
			}
		})
	}
	public sendMessageToChild (instance: ChildInstance, messageConstr: MessageToChildConstr, cb?: any | InstanceCallbackFunction | InstanceCallbackInitFunction) {
		try {

			if (!instance.child) throw new Error(`Instance ${instance.id} has been detached from child process`)
			if (!instance.child.alive) throw new Error(`Child process of instance ${instance.id} has been closed`)
			if (instance.child.isClosing) throw new Error(`Child process of instance ${instance.id} is closing`)
			const message: MessageToChild = {...messageConstr, ...{
				cmdId: instance.child.cmdId++,
				instanceId: instance.id
			}}

			if (
				message.cmd !== MessageType.INIT &&
				!instance.initialized
			) throw Error(`Child instance ${instance.id} is not initialized`)

			if (cb) instance.child.queue[message.cmdId + ''] = cb
			try {
				instance.child.process.send(message, (error) => {
					if (error) {
						if (instance.child.queue[message.cmdId + '']) {
							instance.child.queue[message.cmdId + ''](
								instance,
								new Error(`Error sending message to child process of instance ${instance.id}: ` + error)
							)
							delete instance.child.queue[message.cmdId + '']
						}
					}
				})
			} catch (e) {
				if ((e.toString() || '').match(/circular structure/)) { // TypeError: Converting circular structure to JSON
					throw new Error(`Unsupported attribute (circular structure) in instance ${instance.id}: ` + e.toString())
				} else {
					throw e
				}
			}
		} catch (e) {
			if (cb) cb(instance, (e.stack || e).toString())
			else throw e
		}
	}
	public getChildrenCount (): number {
		return Object.keys(this._children).length
	}
	public killAllChildren (): Promise<void> {
		return Promise.all(
			Object.keys(this._children).map((id) => {
				return this.killChild(id)
			})
		).then(() => {
			return
		})
	}
	public async restart (proxy: ThreadedClass<any>, forceRestart?: boolean): Promise<void> {
		let foundInstance: ChildInstance | undefined
		let foundChild: Child | undefined
		Object.keys(this._children).find((childId: string) => {
			const child = this._children[childId]
			const found = Object.keys(child.instances).find((instanceId: string) => {
				const instance = child.instances[instanceId]
				if (instance.proxy === proxy) {
					foundInstance = instance
					return true
				}
				return false
			})
			if (found) {
				foundChild = child
				return true
			}
			return false
		})
		if (!foundChild) throw Error(`Child of proxy not found`)
		if (!foundInstance) throw Error(`Instance of proxy not found`)

		await this.restartChild(foundChild, [foundInstance], forceRestart)
	}
	public async restartChild (child: Child, onlyInstances?: ChildInstance[], forceRestart?: boolean): Promise<void> {
		if (child.alive && forceRestart) {
			await this.killChild(child, true)
		}

		if (!child.alive) {
			// clear old process:
			child.process.removeAllListeners()
			delete child.process

			Object.keys(child.instances).forEach((instanceId) => {
				const instance = child.instances[instanceId]
				instance.initialized = false
			})

			// start new process
			child.alive = true
			child.isClosing = false
			child.process = this._createFork(child.config, child.pathToWorker)
			this._setupChildProcess(child)
		}
		let p = new Promise((resolve, reject) => {
			const onInit = (child: Child) => {
				if (child === child) {
					resolve()
					this.removeListener('initialized', onInit)
				}
			}
			this.on('initialized', onInit)
			setTimeout(() => {
				reject('Timeout when trying to restart')
				this.removeListener('initialized', onInit)
			}, 1000)
		})
		const promises: Array<Promise<void>> = []

		let instances: ChildInstance[] = (
			onlyInstances ||
			Object.keys(child.instances).map((instanceId) => {
				return child.instances[instanceId]
			})
		)
		instances.forEach((instance) => {

			promises.push(
				new Promise((resolve, reject) => {
					this.sendInit(child, instance, instance.config, (_instance: ChildInstance, err: Error | null) => {
						// no need to do anything, the proxy is already initialized from earlier
						if (err) {
							reject(err)
						} else {
							resolve()
						}
						return true
					})
				})
			)
		})

		await Promise.all(promises)

		await p
	}
	public sendInit (
		child: Child,
		instance: ChildInstance,
		config: ThreadedClassConfig,
		cb?: InstanceCallbackInitFunction
	) {

		let msg: MessageInitConstr = {
			cmd: MessageType.INIT,
			modulePath: instance.pathToModule,
			className: instance.className,
			classFunction: (config.disableMultithreading ? instance.classFunction : undefined),
			args: instance.constructorArgs,
			config: config
		}
		instance.initialized = true
		ThreadedClassManagerInternal.sendMessageToChild(instance, msg, (instance: ChildInstance, e: Error | null, initProps?: InitProps) => {
			if (
				!cb ||
				cb(instance, e, initProps)
			) {
				this.emit('initialized', child)
			}
		})
	}
	public startMonitoringChild (instance: ChildInstance) {
		const pingTime: number = instance.freezeLimit || DEFAULT_CHILD_FREEZE_TIME
		const monitorChild = () => {

			if (instance.child && instance.child.alive && this._pinging) {

				this._pingChild(instance)
				.then(() => {
					// ping successful

					// ping again later:
					setTimeout(() => {
						monitorChild()
					}, pingTime)
				})
				.catch(() => {
					// Ping failed
					if (
						instance.child &&
						instance.child.alive &&
						!instance.child.isClosing
					) {
						// console.log(`Ping failed for Child "${instance.child.id }" of instance "${instance.id}"`)
						this._childHasCrashed(instance.child, `Child process of instance ${instance.id} ping timeout`)
					}
				})

			}
		}
		setTimeout(() => {
			monitorChild()
		}, pingTime)
	}
	public doMethod<T> (child: Child, cb: (resolve: (result: T | PromiseLike<T>) => void, reject: (error: any) => void) => void): Promise<T> {
		// Return a promise that will execute the callback cb
		// but also put the promise in child.methods, so that the promise can be aborted
		// in the case of a child crash

		const methodId: string = 'm' + this._methodId++
		const p = new Promise<T>((resolve, reject) => {
			child.methods[methodId] = { resolve, reject }
			cb(resolve, reject)
		})
		.then((result) => {
			delete child.methods[methodId]
			return result
		})
		.catch((error) => {
			delete child.methods[methodId]
			throw error
		})

		return p
	}
	/** Called before using internally */
	private _init () {
		if (
			!this.isInitialized &&
			!this.dontHandleExit
		) {

			if (!isBrowser()) { // in NodeJS

				// Close the child processes upon exit:
				process.stdin.resume() // so the program will not close instantly

				const exitHandler = (options: any, err: Error) => {
					this.killAllChildren()
					.catch(console.log)
					if (err) console.log(err.stack)
					if (options.exit) process.exit()
				}

				// do something when app is closing
				process.on('exit', exitHandler.bind(null, { cleanup: true }))

				// catches ctrl+c event
				process.on('SIGINT', exitHandler.bind(null, { exit: true }))

				// catches "kill pid" (for example: nodemon restart)
				process.on('SIGUSR1', exitHandler.bind(null, { exit: true }))
				process.on('SIGUSR2', exitHandler.bind(null, { exit: true }))

				// catches uncaught exceptions
				process.on('uncaughtException', exitHandler.bind(null, { exit: true }))
			}
		}
		this.isInitialized = true
	}
	private _pingChild (instance: ChildInstance): Promise<void> {
		return new Promise((resolve, reject) => {
			let msg: MessagePingConstr = {
				cmd: MessageType.PING
			}
			ThreadedClassManagerInternal.sendMessageToChild(instance, msg, (_instance: ChildInstance, err: Error | null) => {
				if (!err) {
					resolve()
				} else {
					console.log('error', err)
					reject()
				}
			})
			setTimeout(() => {
				reject() // timeout
			}, instance.freezeLimit || DEFAULT_CHILD_FREEZE_TIME)
		})
	}
	private _childHasCrashed (child: Child, reason: string) {
		// Called whenever a fatal error with a child has been discovered

		this.rejectChildMethods(child, reason)

		if (!child.isClosing) {
			let shouldRestart = false
			const restartInstances: ChildInstance[] = []
			Object.keys(child.instances).forEach((instanceId) => {
				const instance = child.instances[instanceId]

				if (instance.config.autoRestart) {
					shouldRestart = true
					restartInstances.push(instance)
				}
			})
			if (shouldRestart) {
				this.restartChild(child, restartInstances, true)
				.then(() => {
					this.emit('restarted', child)
				})
				.catch((err) => console.log('Error when running restartChild()', err))
			} else {
				// No instance wants to be restarted, make sure the child is killed then:
				if (child.alive) {
					this.killChild(child, true)
					.catch((err) => console.log('Error when running killChild()', err))
				}
			}
		}
	}
	private _createFork (config: ThreadedClassConfig, pathToWorker: string): ChildProcess | FakeProcess | WebWorkerProcess {
		if (config.disableMultithreading) {
			return new FakeProcess()
		} else {
			if (isBrowser()) {
				return forkWebWorker(pathToWorker)
			} else {
				// in NodeJS
				if (nodeSupportsWorkerThreads()) {
					return forkWorkerThread(pathToWorker)
				} else {
					return fork(pathToWorker)
				}
			}
		}
	}
	private _setupChildProcess (child: Child) {
		child.process.on('close', (_code) => {
			if (child.alive) {
				child.alive = false
				this.emit('thread_closed', child)

				this._childHasCrashed(child, `Child process "${childName(child)}" was closed`)
			}
		})
		child.process.on('error', (err) => {
			console.error('Error from child ' + child.id, err)
		})
		child.process.on('message', (message: MessageFromChild) => {
			if (message.cmd === MessageType.LOG) {
				console.log(message.instanceId, ...message.log)
			} else {
				const instance = child.instances[message.instanceId]
				if (instance) {
					try {
						instance.onMessageCallback(instance, message)
					} catch (e) {
						console.error(`Error in onMessageCallback in instance ${instance.id}`, message, instance)
						console.error(e)
						throw e
					}
				} else {
					console.error(`Instance "${message.instanceId}" not found`)
				}
			}
		})
	}
	private _findFreeChild (threadUsage: number): Child | null {
		let id = Object.keys(this._children).find((id) => {
			const child = this._children[id]
			if (
				!child.isNamed &&
				child.usage + threadUsage <= 1
			) {
				return true
			}
			return false
		})
		if (id) {
			const child = this._children[id]
			child.usage += threadUsage

			return child
		}
		return null
	}
	private killChild (idOrChild: string | Child, dontCleanUp?: boolean): Promise<void> {
		return new Promise((resolve, reject) => {
			let child: Child
			if (typeof idOrChild === 'string') {
				const id = idOrChild
				child = this._children[id]

				if (!child) {
					reject(`killChild: Child ${id} not found`)
					return
				}
			} else {
				child = idOrChild
			}
			if (child) {
				if (!child.alive) {
					delete this._children[child.id]
					resolve()
				} else {
					child.process.once('close', () => {
						if (!dontCleanUp) {
							// Clean up:
							Object.keys(child.instances).forEach(instanceId => {
								const instance = child.instances[instanceId]

								delete instance.child
								delete child.instances[instanceId]
							})
							delete this._children[child.id]
						}
						resolve()
					})
					setTimeout(() => {
						delete this._children[child.id]
						reject('Timeout: Kill child process')
					},1000)
					if (!child.isClosing) {
						child.isClosing = true
						child.process.kill()
					}
				}
			}
		})
	}
	private rejectChildMethods (child: Child, reason: string) {
		Object.keys(child.methods).forEach((methodId) => {
			const method = child.methods[methodId]

			method.reject(Error('Method aborted due to: ' + reason))
		})
		child.methods = {}
	}
}

export enum ThreadMode {
	/** Web-workers, in browser */
	WEB_WORKER = 'web_worker',
	/** Nothing, Web-workers not supported */
	NOT_SUPPORTED = 'not_supported',
	/** Worker threads */
	WORKER_THREADS = 'worker_threads',
	/** Child process */
	CHILD_PROCESS = 'child_process'
}

// Singleton:
export const ThreadedClassManagerInternal = new ThreadedClassManagerClassInternal()
export const ThreadedClassManager = new ThreadedClassManagerClass(ThreadedClassManagerInternal)
