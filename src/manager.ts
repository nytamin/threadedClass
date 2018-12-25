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
	MessageInitConstr
} from './internalApi'
import { EventEmitter } from 'events'

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
	public getProcessCount (): number {
		return this._internal.getChildrenCount()
	}
	public onEvent (proxy: ThreadedClass<any>, event: string, cb: Function) {
		this._internal.on(event, (child: Child) => {
			let foundChild = Object.keys(child.instances).find((instanceId) => {
				const instance = child.instances[instanceId]
				return instance.proxy === proxy
			})
			if (foundChild) {
				cb()
			}
		})
	}
	/**
	 * Restart the process of the proxy instance
	 * @param proxy
	 * @param forceRestart If true, will kill the process and restart it
	 */
	public restart (proxy: ThreadedClass<any>, forceRestart?: boolean) {
		this._internal.restart(proxy, forceRestart)
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
	alive: boolean
	isClosing: boolean
	config: ThreadedClassConfig

	cmdId: number
	queue: {[cmdId: string]: InstanceCallbackFunction}

	callbackId: number
	callbacks: {[key: string]: Function}
}
/**
 * The ChildInstance represents a proxy-instance of a class, running in a child process
 */
export interface ChildInstance {
	readonly id: string
	readonly proxy: ThreadedClass<any>
	readonly usage?: number
	readonly onMessageCallback: (instance: ChildInstance, message: MessageFromChild) => void
	readonly pathToModule: string
	readonly className: string
	readonly constructorArgs: any[]
	readonly config: ThreadedClassConfig
	initialized: boolean
	child: Child
}
export class ThreadedClassManagerClassInternal extends EventEmitter {

	/** Set to true if you want to handle the exiting of child process yourselt */
	public dontHandleExit: boolean = false
	private isInitialized: boolean = false
	private _processId: number = 0
	private _instanceId: number = 0
	private _children: {[id: string]: Child} = {}

	public getChild (
		config: ThreadedClassConfig,
		pathToWorker: string
	): Child {
		this._init()

		let child: Child | null = null
		if (config.processId) {
			child = this._children[config.processId] || null
		} else if (config.processUsage) {
			child = this._findFreeChild(config.processUsage)
		}
		if (!child) {
			// Create new child process:
			const newChild: Child = {
				id: config.processId || ('process_' + this._processId++),
				isNamed: !!config.processId,
				pathToWorker: pathToWorker,

				process: this._createFork(config, pathToWorker),
				usage: config.processUsage || 1,
				instances: {},
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
		constructorArgs: any[],
		onMessage: (instance: ChildInstance, message: MessageFromChild) => void
	): ChildInstance {

		const instance: ChildInstance = {
			id: 'instance_' + this._instanceId++,
			child: child,
			proxy: proxy,
			usage: config.processUsage,
			onMessageCallback: onMessage,
			pathToModule: pathToModule,
			className: className,
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
						this.sendMessage(instance, {
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
	public sendMessage (instance: ChildInstance, messageConstr: MessageToChildConstr, cb?: InstanceCallbackFunction) {
		try {

			if (!instance.child) throw Error('Instance has been detached from child process')
			if (!instance.child.alive) throw Error('Child process has been closed')
			if (instance.child.isClosing) throw Error('Child process is closing')
			const message: MessageToChild = {...messageConstr, ...{
				cmdId: instance.child.cmdId++,
				instanceId: instance.id
			}}

			if (
				message.cmd !== MessageType.INIT &&
				!instance.initialized
			) throw Error('Child instance is not initialized')
			// console.log('sendMessage', instance.child.id, instance.id, message)

			if (cb) instance.child.queue[message.cmdId + ''] = cb
			instance.child.process.send(message)
		} catch (e) {
			if (cb) cb(instance, e.toString())
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
	public restart (proxy: ThreadedClass<any>, forceRestart?: boolean): void {

		let foundInstance: ChildInstance | undefined
		let foundChild0: Child | undefined
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
				foundChild0 = child
				return true
			}
			return false
		})
		if (!foundChild0) throw Error('Child not found')
		if (!foundInstance) throw Error('Instance not found')

		const foundChild: Child = foundChild0

		if (foundChild.alive && forceRestart) {
			foundChild.process.kill()
			foundChild.alive = false
		}

		if (!foundChild.alive) {
			// clear old process:
			foundChild.process.removeAllListeners()
			delete foundChild.process

			Object.keys(foundChild.instances).forEach((instanceId) => {
				const instance = foundChild.instances[instanceId]
				instance.initialized = false
			})

			// start new process
			foundChild.alive = true
			foundChild.isClosing = false
			foundChild.process = this._createFork(foundChild.config, foundChild.pathToWorker)
			this._setupChildProcess(foundChild)
		}

		this.sendInit(foundInstance, foundInstance.config)
	}
	public sendInit (
		instance: ChildInstance,
		config: ThreadedClassConfig,
		cb?: InstanceCallbackFunction
	) {

		let msg: MessageInitConstr = {
			cmd: MessageType.INIT,
			modulePath: instance.pathToModule,
			className: instance.className,
			args: instance.constructorArgs,
			config: config
		}
		instance.initialized = true
		ThreadedClassManagerInternal.sendMessage(instance, msg, cb)
	}
	/** Called before using internally */
	private _init () {
		if (
			!this.isInitialized &&
			!this.dontHandleExit
		) {

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
		this.isInitialized = true
	}
	private _createFork (config: ThreadedClassConfig, pathToWorker: string) {
		if (config.disableMultithreading) {
			return new FakeProcess()
		} else {
			return fork(pathToWorker)
		}
	}
	private _setupChildProcess (child: Child) {
		child.process.on('close', (_code) => {
			// console.log(`child process exited with code ${_code}`)
			if (child.alive) {
				child.alive = false
				this.emit('process_closed', child)

				// TODO: restart?
			}
			// delete this._children[child.id]
		})
		child.process.on('error', (err) => {
			console.log('Error from ' + child.id, err)
		})
		child.process.on('message', (message: MessageFromChild) => {
			const instance = child.instances[message.instanceId]
			if (instance) {
				try {
					// console.log('on message', message)
					instance.onMessageCallback(instance, message)
				} catch (e) {
					console.log('Error in onMessageCallback', message, instance)
					console.log(e)
					throw e
				}
			}
		})
	}
	private _findFreeChild (processUsage: number): Child | null {
		let id = Object.keys(this._children).find((id) => {
			const child = this._children[id]
			if (
				!child.isNamed &&
				child.usage + processUsage <= 1
			) {
				return true
			}
			return false
		})
		if (id) {
			const child = this._children[id]
			child.usage += processUsage

			// console.log('Free child found, usage ' + child.usage)
			return child
		}
		return null
	}
	private killChild (id: string): Promise<void> {
		return new Promise((resolve, reject) => {

			let child = this._children[id]
			if (child) {
				if (!child.alive) {
					delete this._children[id]
					resolve()
				} else {
					child.process.once('close', () => {
						// Clean up:
						Object.keys(child.instances).forEach(instanceId => {
							const instance = child.instances[instanceId]

							delete instance.child
							delete child.instances[instanceId]
						})
						delete this._children[id]
						resolve()
					})
					setTimeout(() => {
						delete this._children[id]
						reject('Timeout: Kill child process')
					},1000)
					if (!child.isClosing) {
						child.isClosing = true
						child.process.kill()
					}
				}
			} else {
				reject(`killChild: Child ${id} not found`)
			}
		})
	}
}
// Singleton:
export const ThreadedClassManagerInternal = new ThreadedClassManagerClassInternal()
export const ThreadedClassManager = new ThreadedClassManagerClass(ThreadedClassManagerInternal)
