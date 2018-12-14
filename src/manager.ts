import { ChildProcess, fork } from 'child_process'
import { ThreadedClassConfig, ThreadedClass } from './api'
import {
	MessageFromChild,
	MessageToChildConstr,
	MessageToChild,
	InstanceCallbackFunction,
	MessageType,
	MessageKillConstr
} from './internalApi'

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
}
/**
 * The Child represents a child process, in which the proxy-classes live and run
 */
export interface Child {
	readonly id: string
	readonly process: ChildProcess
	readonly isNamed: boolean
	usage: number
	instances: {[id: string]: ChildInstance}
	alive: boolean

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
	child: Child
}
export class ThreadedClassManagerClassInternal {

	/** Set to true if you want to handle the exiting of child process yourselt */
	public dontHandleExit: boolean = false
	private isInitialized: boolean = false
	private _processId: number = 0
	private _instanceId: number = 0
	private _children: {[id: string]: Child} = {}

	public getChild (config: ThreadedClassConfig, pathToWorker: string): Child {
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
				process: fork(pathToWorker),
				usage: config.processUsage || 1,
				instances: {},
				alive: true,
				cmdId: 0,
				queue: {},
				callbackId: 0,
				callbacks: {}
			}
			newChild.process.on('close', (_code) => {
				// console.log(`child process exited with code ${code}`)
				newChild.alive = false
			})
			newChild.process.on('message', (message: MessageFromChild) => {
				const instance = newChild.instances[message.instanceId]
				if (instance) {
					try {
						instance.onMessageCallback(instance, message)
					} catch (e) {
						console.log('Error in onMessageCallback', instance, message)
						throw e
					}
				}
			})
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
		onMessage: (instance: ChildInstance, message: MessageFromChild) => void
	): ChildInstance {

		const instance: ChildInstance = {
			id: 'instance_' + this._instanceId++,
			child: child,
			proxy: proxy,
			usage: config.processUsage,
			onMessageCallback: onMessage
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

					const cleanup = () => {
						delete instance.child
						delete child.instances[instanceId]
					}

					if (Object.keys(child.instances).length === 1) {
						// if there is only one instance left, we can kill the child
						this.killChild(childId)
						.then(resolve)
						.catch(reject)

					} else {
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
		if (!instance.child.alive) throw Error('Child process has been closed')
		const message: MessageToChild = {...messageConstr, ...{
			cmdId: instance.child.cmdId++,
			instanceId: instance.id
		}}
		// console.log('sendMessage', instance.child.id, instance.id, message)
		instance.child.process.send(message)

		if (cb) instance.child.queue[message.cmdId + ''] = cb
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
			if (child && child.alive) {
				child.alive = false

				Object.keys(child.instances).forEach((instanceId) => {
					let instance = child.instances[instanceId]

					delete instance.child
					delete child.instances[instanceId]
				})

				child.process.once('close', () => {
					delete this._children[id]
					resolve()
				})
				setTimeout(() => {
					delete this._children[id]
					reject('Timeout: Kill child process')
				},1000)
				child.process.kill()

			} else {
				reject(`killChild: Child ${id} not found`)
			}
		})
	}
}
// Singleton:
export const ThreadedClassManagerInternal = new ThreadedClassManagerClassInternal()
export const ThreadedClassManager = new ThreadedClassManagerClass(ThreadedClassManagerInternal)
