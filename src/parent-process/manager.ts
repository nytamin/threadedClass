import { EventEmitter } from 'events'
import {
	InitProps,
	DEFAULT_CHILD_FREEZE_TIME,
	encodeArguments,
	CallbackFunction,
	Message,
	ArgDefinition,
	decodeArguments
} from '../shared/sharedApi'
import { ThreadedClassConfig, ThreadedClass, MemUsageReport, MemUsageReportInner } from '../api'
import { isBrowser, nodeSupportsWorkerThreads, browserSupportsWebWorkers } from '../shared/lib'
import { forkWebWorker } from './workerPlatform/webWorkers'
import { forkWorkerThread } from './workerPlatform/workerThreads'
import { WorkerPlatformBase } from './workerPlatform/_base'
import { forkChildProcess } from './workerPlatform/childProcess'
import { FakeProcess } from './workerPlatform/fakeWorker'

export class ThreadedClassManagerClass {

	private _internal: ThreadedClassManagerClassInternal
	constructor (internal: ThreadedClassManagerClassInternal) {
		this._internal = internal
		this._internal.setMaxListeners(0)
	}
	/** Enable debug messages */
	public set debug (v: boolean) {
		this._internal.debug = v
	}
	public get debug (): boolean {
		return this._internal.debug
	}
	public set dontHandleExit (v: boolean) {
		this._internal.dontHandleExit = v
	}
	public get dontHandleExit (): boolean {
		return this._internal.dontHandleExit
	}

	/** Destroy a proxy class */
	public destroy (proxy: ThreadedClass<any>): Promise<void> {
		return this._internal.killProxy(proxy)
	}
	public destroyAll (): Promise<void> {
		return this._internal.killAllChildren()
	}
	/** Returns the number of threads */
	public getThreadCount (): number {
		return this._internal.getChildrenCount()
	}
	/** Returns memory usage for all threads */
	public getThreadsMemoryUsage (): Promise<{[childId: string]: MemUsageReport}> {
		return this._internal.getMemoryUsage()
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
	process: WorkerPlatformBase
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
	instanceMessageQueue: {[cmdId: string]: InstanceCallbackFunction }
	childMessageQueue: {[cmdId: string]: CallbackFunction }

	callbackId: number
	callbacks: {[key: string]: Function}
}
export function childName (child: Child) {
	return `Child_ ${Object.keys(child.instances).join(',')}`
}
export type InstanceCallbackFunction = (instance: ChildInstance, e: Error | string | null, encodedResult?: ArgDefinition) => void
export type InstanceCallbackInitFunction = (instance: ChildInstance, e: Error | string | null, initProps?: InitProps) => boolean
/**
 * The ChildInstance represents a proxy-instance of a class, running in a child process
 */
export interface ChildInstance {
	readonly id: string
	readonly proxy: ThreadedClass<any>
	readonly usage?: number
	/** When to consider the process is frozen */
	readonly freezeLimit?: number
	readonly onMessageCallback: (instance: ChildInstance, message: Message.From.Instance.Any) => void
	readonly pathToModule: string
	readonly exportName: string
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
	public debug: boolean = false
	/** Pseudo-unique id to identify the parent ThreadedClass (for debugging) */
	private uniqueId: number = Date.now() % 10000

	public findNextAvailableChild (
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
				id: config.threadId || (`process_${this.uniqueId}_${this._threadId++}`),
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
				instanceMessageQueue: {},
				childMessageQueue: {},
				callbackId: 0,
				callbacks: {}
			}
			this._setupChildProcess(newChild)
			this._children[newChild.id] = newChild
			child = newChild

			if (this.debug) this.consoleLog(`New child: "${newChild.id}"`)
		}

		return child
	}
	/**
	 * Attach a proxy-instance to a child
	 * @param child
	 * @param proxy
	 * @param onInstanceMessage
	 */
	public attachInstanceToChild (
		config: ThreadedClassConfig,
		child: Child,
		proxy: ThreadedClass<any>,
		pathToModule: string,
		exportName: string,
		constructorArgs: any[],
		onInstanceMessage: (instance: ChildInstance, message: Message.From.Instance.Any) => void
	): ChildInstance {
		const instance: ChildInstance = {

			id: `instance_${this.uniqueId}_${this._instanceId++}` + (config.instanceName ? `_${config.instanceName}` : ''),
			child: child,
			proxy: proxy,
			usage: config.threadUsage,
			freezeLimit: config.freezeLimit,
			onMessageCallback: onInstanceMessage,
			pathToModule: pathToModule,
			exportName: exportName,
			constructorArgs: constructorArgs,
			initialized: false,
			config: config
		}
		child.instances[instance.id] = instance

		if (this.debug) this.consoleLog(`Add instance "${instance.id}" to "${child.id}"`)

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
						this.sendMessageToInstance(instance, {
							cmd: Message.To.Instance.CommandType.KILL
						} as Message.To.Instance.KillConstr, () => {
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
				reject('killProxy: Proxy not found')
			}
		})
	}
	public sendMessageToInstance (instance: ChildInstance, messageConstr: Message.To.Instance.AnyConstr, cb?: any | InstanceCallbackFunction | InstanceCallbackInitFunction) {
		try {

			if (!instance.child) throw new Error(`Instance ${instance.id} has been detached from child process`)
			if (!instance.child.alive) throw new Error(`Child process of instance ${instance.id} has been closed`)
			if (instance.child.isClosing) throw new Error(`Child process of instance ${instance.id} is closing`)
			const message: Message.To.Instance.Any = {...messageConstr, ...{
				messageType: 'instance',
				cmdId: instance.child.cmdId++,
				instanceId: instance.id
			}}

			if (
				message.cmd !== Message.To.Instance.CommandType.INIT &&
				!instance.initialized
			) throw Error(`Child instance ${instance.id} is not initialized`)

			if (cb) instance.child.instanceMessageQueue[message.cmdId + ''] = cb
			try {
				instance.child.process.send(message)
			} catch (e) {
				delete instance.child.instanceMessageQueue[message.cmdId + '']
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
	public sendMessageToChild (child: Child, messageConstr: Message.To.Child.AnyConstr, cb?: CallbackFunction) {
		try {
			if (!child.alive) throw new Error(`Child process ${child.id} has been closed`)
			if (child.isClosing) throw new Error(`Child process  ${child.id} is closing`)

			const message: Message.To.Child.Any = {...messageConstr, ...{
				messageType: 'child',
				cmdId: child.cmdId++
			}}

			if (cb) child.childMessageQueue[message.cmdId + ''] = cb
			try {
				child.process.send(message)
			} catch (e) {
				delete child.childMessageQueue[message.cmdId + '']
				if ((e.toString() || '').match(/circular structure/)) { // TypeError: Converting circular structure to JSON
					throw new Error(`Unsupported attribute (circular structure) in child ${child.id}: ` + e.toString())
				} else {
					throw e
				}
			}
		} catch (e) {
			if (cb) cb((e.stack || e).toString())
			else throw e
		}
	}
	public getChildrenCount (): number {
		return Object.keys(this._children).length
	}
	public async getMemoryUsage (): Promise<{[childId: string]: MemUsageReport}> {

		const memUsage: {[childId: string]: MemUsageReport} = {}

		await Promise.all(
			Object.keys(this._children).map((childId) => {
				return new Promise((resolve) => {
					const child = this._children[childId]
					this.sendMessageToChild(child, {
						cmd: Message.To.Child.CommandType.GET_MEM_USAGE
					}, (err, result0) => {
						const result = result0 && decodeArguments(() => null, [result0], () => (() => Promise.resolve()))[0] as MemUsageReportInner

						const o: MemUsageReport = {
							...(
								err ?
								{ error: err.toString() } :
								result ?
								result :
								{ error: 'unknown' }
							),
							description: this.getChildDescriptor(child)
						}
						memUsage[childId] = o
						resolve()
					})
				})
			})
		)
		return memUsage
	}
	public killAllChildren (): Promise<void> {
		return Promise.all(
			Object.keys(this._children).map((id) => {
				const child = this._children[id]
				if (this.debug) this.consoleLog(`Killing child "${this.getChildDescriptor(child)}"`)
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
		let encodedArgs = encodeArguments(instance, instance.child.callbacks, instance.constructorArgs, !!config.disableMultithreading)

		let msg: Message.To.Instance.InitConstr = {
			cmd: Message.To.Instance.CommandType.INIT,
			modulePath: instance.pathToModule,
			exportName: instance.exportName,
			args: encodedArgs,
			config: config,
			parentPid: process.pid
		}
		instance.initialized = true
		ThreadedClassManagerInternal.sendMessageToInstance(instance, msg, (instance: ChildInstance, e: Error | null, initProps?: InitProps) => {
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
						// this.consoleLog(`Ping failed for Child "${instance.child.id }" of instance "${instance.id}"`)
						this._childHasCrashed(instance.child, `Child process ("${this.getChildDescriptor(instance.child)}") of instance ${instance.id} ping timeout`)
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
	public getChildDescriptor (child: Child): string {
		return `${child.id} (${Object.keys(child.instances).join(', ')})`
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

				// Read about Node signals here:
				// https://nodejs.org/api/process.html#process_signal_events

				const onSignal = (signal: string, message?: string) => {
					let msg = `Signal "${signal}" event`
					if (message) msg += ', ' + message
					if (this.debug) this.consoleLog(msg)

					this.killAllChildren()
					.catch(this.consoleError)

					process.exit()
				}

				// Do something when app is closing:
				process.on('exit', (code: number) => onSignal('process.exit', `exit code: ${code}`))

				// catches ctrl+c event
				process.on('SIGINT', () => onSignal('SIGINT'))
				// Terminal windows closed
				process.on('SIGHUP', () => onSignal('SIGHUP'))
				process.on('SIGTERM', () => onSignal('SIGTERM'))
				// SIGKILL cannot have a listener attached
				// SIGSTOP cannot have a listener attached

				// catches "kill pid" (for example: nodemon restart)
				process.on('SIGUSR1', () => onSignal('SIGUSR1'))
				process.on('SIGUSR2', () => onSignal('SIGUSR2'))

				// catches uncaught exceptions
				process.on('uncaughtException', (message) => onSignal('uncaughtException', message.toString()))
			}
		}
		this.isInitialized = true
	}
	private _pingChild (instance: ChildInstance): Promise<void> {
		return new Promise((resolve, reject) => {
			let msg: Message.To.Instance.PingConstr = {
				cmd: Message.To.Instance.CommandType.PING
			}
			ThreadedClassManagerInternal.sendMessageToInstance(instance, msg, (_instance: ChildInstance, err: Error | null) => {
				if (!err) {
					resolve()
				} else {
					this.consoleError(err)
					reject(err)
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
				.catch((err) => this.consoleError('Error when running restartChild()', err))
			} else {
				// No instance wants to be restarted, make sure the child is killed then:
				if (child.alive) {
					this.killChild(child, true)
					.catch((err) => this.consoleError('Error when running killChild()', err))
				}
			}
		}
	}
	private _createFork (config: ThreadedClassConfig, pathToWorker: string): WorkerPlatformBase {
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
					return forkChildProcess(pathToWorker)
				}
			}
		}
	}
	private _setupChildProcess (child: Child) {
		child.process.on('close', () => {
			if (child.alive) {
				child.alive = false
				this.emit('thread_closed', child)

				this._childHasCrashed(child, `Child process "${childName(child)}" was closed`)
			}
		})
		child.process.on('error', (err) => {
			this.consoleError('Error from child ' + child.id, err)
		})
		child.process.on('message', (message: Message.From.Any) => {
			if (message.messageType === 'child') {
				try {
					this._onMessageFromChild(child, message)
				} catch (e) {
					this.consoleError(`Error in onMessageCallback in child ${child.id}`, message)
					this.consoleError(e)
					throw e
				}
			} else if (message.messageType === 'instance') {
				const instance = child.instances[message.instanceId]
				if (instance) {
					try {
						instance.onMessageCallback(instance, message)
					} catch (e) {
						this.consoleError(`Error in onMessageCallback in instance ${instance.id}`, message, instance)
						this.consoleError(e)
						throw e
					}
				} else {
					this.consoleError(`Instance "${message.instanceId}" not found. Received message "${message.messageType}" from child "${child.id}", "${childName(child)}"`)
				}
			} else {
				this.consoleError(`Unknown messageType "${message['messageType']}"!`)
			}
		})
	}
	private _onMessageFromChild (child: Child, message: Message.From.Child.Any) {
		if (message.cmd === Message.From.Child.CommandType.LOG) {
			console.log(child.id, ...message.log)
		} else if (message.cmd === Message.From.Child.CommandType.REPLY) {
			let msg: Message.From.Child.Reply = message

			let cb: CallbackFunction = child.childMessageQueue[msg.replyTo + '']
			if (!cb) return
			if (msg.error) {
				cb(msg.error)
			} else {
				cb(null, msg.reply)
			}
			delete child.instanceMessageQueue[msg.replyTo + '']
		} else if (message.cmd === Message.From.Child.CommandType.CALLBACK) {
			// Callback function is called by worker
			let msg: Message.From.Child.Callback = message
			let callback = child.callbacks[msg.callbackId]
			if (callback) {
				try {
					Promise.resolve(callback(...msg.args))
					.then((result: any) => {
						let encodedResult = encodeArguments({}, child.callbacks, [result], !!child.process.isFakeProcess)
						this._sendReplyToChild(
							child,
							msg.cmdId,
							undefined,
							encodedResult[0]
						)
					})
					.catch((err: Error) => {
						this._replyErrorToChild(child, msg, err)
					})
				} catch (err) {
					this._replyErrorToChild(child, msg, err)
				}
			} else throw Error(`callback "${msg.callbackId}" not found in child ${child.id}`)
		}
	}
	private _replyErrorToChild (child: Child, messageToReplyTo: Message.From.Child.Callback, error: Error) {
		this._sendReplyToChild(child, messageToReplyTo.cmdId, error)
	}
	private _sendReplyToChild (child: Child, replyTo: number, error?: Error, reply?: any, cb?: CallbackFunction) {
		let msg: Message.To.Child.ReplyConstr = {
			cmd: Message.To.Child.CommandType.REPLY,
			replyTo: replyTo,
			reply: reply,
			error: error ? (error.stack || error).toString() : error
		}
		this.sendMessageToChild(child, msg, cb)
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
						reject(`Timeout: Kill child process "${child.id}"`)
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
	/** trace to console.error */
	private consoleError (...args: any[]) {
		console.error(`ThreadedClass Error (${this.uniqueId})`, ...args)

	}
	/** trace to console.log */
	private consoleLog (...args: any[]) {
		console.log(`ThreadedClass (${this.uniqueId})`, ...args)

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
