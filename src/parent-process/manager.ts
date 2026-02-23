import {
	InitProps,
	DEFAULT_CHILD_FREEZE_TIME,
	DEFAULT_RESTART_TIMEOUT,
	DEFAULT_KILL_TIMEOUT,
	encodeArguments,
	CallbackFunction,
	Message,
	ArgDefinition,
	decodeArguments,
	DEFAULT_AUTO_RESTART_RETRY_COUNT,
	DEFAULT_AUTO_RESTART_RETRY_DELAY
} from '../shared/sharedApi'
import { ThreadedClassConfig, ThreadedClass, MemUsageReport, MemUsageReportInner, RestartTimeoutError, KillTimeoutError } from '../api'
import { isBrowser, nodeSupportsWorkerThreads, browserSupportsWebWorkers, ArrayMap } from '../shared/lib'
import { forkWebWorker } from './workerPlatform/webWorkers'
import { forkWorkerThread } from './workerPlatform/workerThreads'
import { WorkerPlatformBase } from './workerPlatform/_base'
import { forkChildProcess } from './workerPlatform/childProcess'
import { FakeProcess } from './workerPlatform/fakeWorker'

export enum RegisterExitHandlers {
	/**
	 * Do a check if any exit handlers have been registered by someone else.
	 * If not, will set up exit handlers to ensure child processes are killed on exit signal.
	 */
	AUTO = -1,
	/** Set up exit handlers to ensure child processes are killed on exit signal. */
	YES = 1,
	/**
	 * Don't set up any exit handlers (depending on your environment and Node version,
	 * children might need to be manually killed).
	 */
	NO = 0
}

export class ThreadedClassManagerClass {

	private _internal: ThreadedClassManagerClassInternal
	constructor (internal: ThreadedClassManagerClassInternal) {
		this._internal = internal
	}
	/** Enable debug messages */
	public set debug (v: boolean) {
		this._internal.debug = v
	}
	public get debug (): boolean {
		return this._internal.debug
	}
	/**
	 * Enable strict mode.
	 * When strict mode is enabled, checks will be done to ensure that best-practices are followed (such as listening to the proper events, etc).
	 * Warnings will be output to the console if strict mode is enabled.
	 */
	public set strict (v: boolean) {
		this._internal.strict = v
	}
	public get strict (): boolean {
		return this._internal.strict
	}
	/** Whether to register exit handlers. If not, then the application should ensure the threads are aborted on process exit */
	public set handleExit (v: RegisterExitHandlers) {
		this._internal.handleExit = v
	}
	public get handleExit (): RegisterExitHandlers {
		return this._internal.handleExit
	}

	/** Destroy a proxy class instance */
	public destroy (proxy: ThreadedClass<any>): Promise<void> {
		return this._internal.killProxy(proxy)
	}
	/** Destroys all proxy instances and closes all threads */
	public destroyAll (): Promise<void> {
		return this._internal.killAllChildren()
	}
	/** Returns the number of threads */
	public getThreadCount (): number {
		return this._internal.getChildrenCount()
	}
	/** Returns memory usage for each thread */
	public getThreadsMemoryUsage (): Promise<{[childId: string]: MemUsageReport}> {
		return this._internal.getMemoryUsage()
	}
	public onEvent (proxy: ThreadedClass<any>, event: string, cb: Function): { stop: () => void } {
		return this._internal.onProxyEvent(proxy, event, cb)
	}
	/**
	 * Restart the thread of the proxy instance
	 * @param proxy
	 * @param forceRestart If true, will kill the thread and restart it. If false, will only restart the thread if it is already dead.
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
		methodName: string
		resolve: (result: any) => void,
		reject: (error: any) => void
	}}
	alive: boolean
	isClosing: boolean
	config: ThreadedClassConfig
	autoRestartFailCount: number
	autoRestartRetryTimeout: ReturnType<typeof setTimeout> | undefined

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
export class ThreadedClassManagerClassInternal {

	/** Set to true if you want to handle the exiting of child process yourselt */
	public handleExit = RegisterExitHandlers.AUTO
	private isInitialized: boolean = false
	private _threadId: number = 0
	private _instanceId: number = 0
	private _methodId: number = 0
	private _children: {[id: string]: Child} = {}
	private _pinging: boolean = true // for testing only
	public debug: boolean = false
	public strict: boolean = false
	/** Pseudo-unique id to identify the parent ThreadedClass (for debugging) */
	private uniqueId: number = Date.now() % 10000
	/** Two-dimensional map, which maps Proxy -> event -> listener functions */
	private _proxyEventListeners: Map<
		ThreadedClass<any>, // Proxy
		ArrayMap<string, Function> // event, listener
	> = new Map()
	/** Contains a map of listeners, used to wait for a child to have been initialized */
	private _childInitializedListeners: ArrayMap<string, () => void> = new ArrayMap()

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
				autoRestartFailCount: 0,
				autoRestartRetryTimeout: undefined,

				cmdId: 0,
				instanceMessageQueue: {},
				childMessageQueue: {},
				callbackId: 0,
				callbacks: {}
			}
			this._setupChildProcess(newChild)
			this._children[newChild.id] = newChild
			child = newChild

			this.debugLog(`New child: "${newChild.id}"`)
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

		this.debugLog(`Add instance "${instance.id}" to "${child.id}"`)

		return instance
	}
	public killProxy (proxy: ThreadedClass<any>): Promise<void> {

		return new Promise((resolve, reject) => {
			let foundProxy = false
			for (const childId of Object.keys(this._children)) {
				const child = this._children[childId]

				const instanceId = this.findProxyInstanceOfChild(child, proxy)
				if (instanceId) {
					let instance = child.instances[instanceId]
					foundProxy = true

					if (Object.keys(child.instances).length === 1) {
						// if there is only one instance left, we can kill the child
						this.killChild(childId, 'no instances left')
						.then(resolve)
						.catch(reject)

					} else {
						const cleanup = () => {
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
					break
				}
			}
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
				return new Promise<void>((resolve) => {
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
				this.debugLog(`Killing child "${this.getChildDescriptor(child)}"`)
				return this.killChild(id, 'killAllChildren')
			})
		).then(() => {
			return
		})
	}
	/** Restart the thread of a proxy instance */
	public async restart (proxy: ThreadedClass<any>, forceRestart?: boolean): Promise<void> {
		let foundInstance: ChildInstance | undefined
		let foundChild: Child | undefined
		for (const child of Object.values(this._children)) {
			const foundInstanceId = this.findProxyInstanceOfChild(child, proxy)
			if (foundInstanceId) {
				foundInstance = child.instances[foundInstanceId]
				foundChild = child
				break
			}
		}
		if (!foundChild) throw Error(`Child of proxy not found`)
		if (!foundInstance) throw Error(`Instance of proxy not found`)

		await this.restartChild(foundChild, [foundInstance], forceRestart)
	}
	public async restartChild (child: Child, onlyInstances?: ChildInstance[], forceRestart?: boolean): Promise<void> {
		if (child.alive && forceRestart) {
			await this.killChild(child, 'restart child', false)
		}

		this.clearRestartTimeout(child)

		if (!child.alive) {
			// clear old process:
			child.process.removeAllListeners()
			// delete child.process

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
		let p = new Promise<void>((resolve, reject) => {
			let timeout: NodeJS.Timeout | undefined
			if (child.config.restartTimeout !== 0) {
				const restartTimeout = child.config.restartTimeout ?? DEFAULT_RESTART_TIMEOUT
				timeout = setTimeout(() => {
					reject(new RestartTimeoutError(`Timeout when trying to restart after ${restartTimeout}`))
					// Remove listener:
					this._childInitializedListeners.remove(child.id, onInit)

				}, restartTimeout)
			}

			const onInit = () => {
				if (timeout) clearTimeout(timeout)
				resolve()
				// Remove listener:
				this._childInitializedListeners.remove(child.id, onInit)
			}

			this._childInitializedListeners.push(child.id, onInit)
		})

		const promises: Array<Promise<void>> = [p]

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
	}
	private canRetryRestart (child: Child) {
		const autoRestartRetryCount = child.config.autoRestartRetryCount ?? DEFAULT_AUTO_RESTART_RETRY_COUNT

		if (autoRestartRetryCount === 0) return true // restart indefinitely
		return child.autoRestartFailCount < autoRestartRetryCount
	}

	public sendInit (
		child: Child,
		instance: ChildInstance,
		config: ThreadedClassConfig,
		cb?: InstanceCallbackInitFunction
	) {
		let encodedArgs = encodeArguments(instance, instance.child.callbacks, instance.constructorArgs, child.process.encodingStrategy)

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
				// Notify listeners that the instance is initialized:
				const listeners = this._childInitializedListeners.get(child.id)
				if (listeners) {
					for (const listener of listeners) {
						listener()
					}
				}
			}
		})
	}
	public startMonitoringChild (instance: ChildInstance) {
		const pingTime: number = instance.freezeLimit ?? DEFAULT_CHILD_FREEZE_TIME
		if (pingTime === 0) return // 0 disables the monitoring

		const monitorChild = () => {

			if (instance.child && instance.child.alive && this._pinging) {

				this._pingChild(instance, pingTime)
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
	public doMethod<T> (child: Child, methodName: string, cb: (resolve: (result: T | PromiseLike<T>) => void, reject: (error: any) => void) => void): Promise<T> {
		// Return a promise that will execute the callback cb
		// but also put the promise in child.methods, so that the promise can be aborted
		// in the case of a child crash

		const methodId: string = 'm' + this._methodId++
		const p = new Promise<T>((resolve, reject) => {
			child.methods[methodId] = { methodName, resolve, reject }
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
	public checkInstance (instance: ChildInstance, errStack: Error) {
		if (!this.strict) return

		const getStack = () => {
			// strip first 2 lines of the stack:
			return `${errStack.stack}`.split('\n').slice(2).join('\n')

		}

		// Wait a little bit, to allow for the events to have been set up asynchronously in user-land:
		setTimeout(() => {

			// Ensure that error events are set up:
			const events = this._proxyEventListeners.get(instance.proxy)
			if (!events || events.arraySize('error') === 0) {
				this.consoleLog(`Warning: No listener for the 'error' event was registered,
Solve this by adding
ThreadedClassManager.onEvent(instance, 'error', (error) => {})
${getStack()}`)
			}

			if (!events || events.arraySize('warning') === 0) {
				this.consoleLog(`Warning: No listener for the 'warning' event was registered,
Solve this by adding
ThreadedClassManager.onEvent(instance, 'warning', (warning) => {})
${getStack()}`)
			}

			if (!instance.config.autoRestart) {
				if (!events || events.arraySize('thread_closed') === 0) {
					this.consoleLog(`Warning: autoRestart is disabled and no listener for the 'thread_closed' event was registered.
Solve this by either set {autoRestart: true} in threadedClass() options, or set up an event listener to handle a restart:
use ThreadedClassManager.onEvent(instance, 'thread_closed', () => {})
at ${getStack()}`)
				}
			} else {
				if (!events || events.arraySize('restarted') === 0) {
					this.consoleLog(`Warning: No listener for the 'restarted' event was registered.
It is recommended to set up an event listener for this, so you are aware of that an instance has been restarted:
use ThreadedClassManager.onEvent(instance, 'restarted', () => {})
${getStack()}`)
				}
			}
		}, 1)
	}
	public onProxyEvent (proxy: ThreadedClass<any>, event: string, cb: Function): { stop: () => void } {
		let events = this._proxyEventListeners.get(proxy)
		if (!events) events = new ArrayMap()

		events.push(event, cb)

		// Save changes:
		this._proxyEventListeners.set(proxy, events)

		return {
			stop: () => {

				const events = this._proxyEventListeners.get(proxy)
				if (!events) return

				events.remove(event, cb)

				// Save changes:
				if (events.size > 0) {
					this._proxyEventListeners.set(proxy, events)
				} else {
					this._proxyEventListeners.delete(proxy)
				}
			}
		}
	}
	private _emitProxyEvent (child: Child, event: string, ...args: any[]) {

		for (const instance of Object.values(child.instances)) {
			const events = this._proxyEventListeners.get(instance.proxy)
			if (events) {
				const listeners = events.get(event)
				if (listeners) {
					for (const listener of listeners) {
						try {
							listener(...args)
						} catch (err) {
							this.consoleLog(`Error in event listener for "${event}":`, err)
						}
					}
				}
			}

		}

	}
	/** Called before using internally */
	private _init () {
		if (
			!this.isInitialized &&
			!isBrowser() // in NodeJS
		) {
			let registerExitHandlers: boolean

			switch (this.handleExit) {
				case RegisterExitHandlers.YES:
					registerExitHandlers = true
					break
				case RegisterExitHandlers.AUTO:
					if (process.listenerCount('exit') === 0 || process.listenerCount('uncaughtException') === 0 || process.listenerCount('unhandledRejection') === 0) {
						this.consoleLog('Skipping exit handler registration as no exit handler is registered')
						// If no listeners are registered,
						// we don't want to change the default Node behaviours upon those signals
						registerExitHandlers = false
					} else {
						registerExitHandlers = true
					}
					break
				default: // RegisterExitHandlers.NO
					registerExitHandlers = false
			}

			if (registerExitHandlers) {
				// Close the child processes upon exit:
				process.stdin.resume() // so the program will not close instantly

				// Read about Node signals here:
				// https://nodejs.org/api/process.html#process_signal_events

				const onSignal = (signal: string, message?: string) => {
					let msg = `Signal "${signal}" event`
					if (message) msg += ', ' + message

					if (process.listenerCount(signal) === 1) {
						// If there is only one listener, that's us
						// Log the error, it is the right thing to do.
						console.error(msg)
					} else {
						if (this.debug) this.consoleLog(msg)
					}

					this.killAllChildren()
					.catch(this.consoleError)

					process.exit()
				}

				// Do something when app is closing:
				process.on('exit', (code: number) => onSignal('exit', `exit code: ${code}`))

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
				process.on('unhandledRejection', (message) => onSignal('unhandledRejection', message ? message.toString() : undefined))
			}
		}
		this.isInitialized = true
	}
	private _pingChild (instance: ChildInstance, timeoutTime: number): Promise<void> {
		return new Promise((resolve, reject) => {
			let msg: Message.To.Instance.PingConstr = {
				cmd: Message.To.Instance.CommandType.PING
			}
			const timeout = setTimeout(() => {
				reject() // timeout
			}, timeoutTime)

			ThreadedClassManagerInternal.sendMessageToInstance(instance, msg, (_instance: ChildInstance, err: Error | null) => {
				clearTimeout(timeout)
				if (!err) {
					resolve()
				} else {
					this.consoleError(err)
					reject(err)
				}
			})

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
					child.autoRestartFailCount = 0

					this._emitProxyEvent(child, 'restarted')
				})
				.catch((err) => {
					// The restart failed
					child.autoRestartFailCount++

					// Try to restart it again:
					if (this.canRetryRestart(child)) {
						this._emitProxyEvent(child, 'warning', `Error when restarting child, trying again... Original error: ${err}`)

						// Kill the child, so we can to restart it later:
						this.killChild(child, 'error when restarting', false)
						.catch((e) => {
							this.consoleError(`Could not kill child: "${child.id}"`, e)
						})
						.then(() => {
							const autoRestartRetryDelay = child.config.autoRestartRetryDelay ?? DEFAULT_AUTO_RESTART_RETRY_DELAY
							child.autoRestartRetryTimeout = setTimeout(() => {
								this._childHasCrashed(child, `restart failed`)
							}, autoRestartRetryDelay)
						})
						.catch((e) => {
							this.consoleError(`Unknown error: "${child.id}"`, e)
						})

					} else {
						this._emitProxyEvent(child, 'error', err)
						this.debugLogError('Error when running restartChild()', err)

						// Clean up the child:
						this.killChild(child, 'timeout when restarting', true).catch((e) => {
							this.consoleError(`Could not kill child: "${child.id}"`, e)
						})
					}
				})
			} else {
				// No instance wants to be restarted, make sure the child is killed then:
				if (child.alive) {
					this.killChild(child, `child has crashed (${reason})`, false)
					.catch((err) => {
						this._emitProxyEvent(child, 'error', err)
						this.debugLogError('Error when running killChild()', err)
					})
				}
			}
		}
	}
	private clearRestartTimeout (child: Child) {
		if (child.autoRestartRetryTimeout !== undefined) {
			clearTimeout(child.autoRestartRetryTimeout)
			child.autoRestartRetryTimeout = undefined
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
				this._emitProxyEvent(child, 'thread_closed')

				this._childHasCrashed(child, `Child process "${childName(child)}" was closed`)
			}
		})
		child.process.on('error', (err) => {
			this._emitProxyEvent(child, 'error', err)
			this.debugLogError('Error from child ' + child.id, err)
		})
		child.process.on('message', (message: Message.From.Any) => {
			if (message.messageType === 'child') {
				try {
					this._onMessageFromChild(child, message)
				} catch (e) {
					this.debugLogError(`Error in onMessageCallback in child ${child.id}`, message, e)
					throw e
				}
			} else if (message.messageType === 'instance') {
				const instance = child.instances[message.instanceId]
				if (instance) {
					try {
						instance.onMessageCallback(instance, message)
					} catch (e) {
						this.debugLogError(`Error in onMessageCallback in instance ${instance.id}`, message, instance, e)
						throw e
					}
				} else {
					const err = new Error(`Instance "${message.instanceId}" not found. Received message "${message.messageType}" from child "${child.id}", "${childName(child)}"`)
					this._emitProxyEvent(child, 'error', err)
					this.debugLogError(err)
				}
			} else {
				const err = new Error(`Unknown messageType "${message['messageType']}"!`)
				this._emitProxyEvent(child, 'error', err)
				this.debugLogError(err)
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
		}
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
	private killChild (idOrChild: string | Child, reason: string, cleanUp: boolean = true): Promise<void> {
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
			this.debugLog(`Killing child ${child.id} due to: ${reason}`)
			if (child) {
				if (cleanUp) {
					this.clearRestartTimeout(child)
				}
				if (!child.alive) {
					if (cleanUp) {
						delete this._children[child.id]
					}
					child.isClosing = false
					resolve()
				} else {
					let timeout: NodeJS.Timeout | undefined
					const killTimeout = child.config.killTimeout ?? DEFAULT_KILL_TIMEOUT
					if (killTimeout !== 0) {
						timeout = setTimeout(() => {
							if (cleanUp) {
								delete this._children[child.id]
							}
							reject(new KillTimeoutError(`Timeout: Kill child process "${child.id}"`))
						}, killTimeout)
					}
					child.process.once('close', () => {
						if (cleanUp) {
							// Clean up:
							Object.entries(child.instances).forEach(([instanceId, instance]) => {
								// const instance = child.instances[instanceId]
								// delete instance.child
								delete child.instances[instanceId]

								const events = this._proxyEventListeners.get(instance.proxy)
								events?.clear()
								this._proxyEventListeners.delete(instance.proxy)
							})
							delete this._children[child.id]
						}
						if (timeout) {
							clearTimeout(timeout)
						}
						child.isClosing = false
						resolve()
					})

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

			method.reject(Error(`Method "${method.methodName}()" aborted due to: ${reason}`))
		})
		child.methods = {}
	}
	/** trace to console.error if debugging is enabled */
	public debugLogError (...args: any[]) {
		if (this.debug) this.consoleError(...args)

	}
	/** trace to console.error if debugging is enabled */
	public debugLog (...args: any[]) {
		if (this.debug) this.consoleLog(...args)

	}

	/** trace to console.error */
	private consoleError (...args: any[]) {
		console.error(`ThreadedClass Error (${this.uniqueId})`, ...args)

	}
	/** trace to console.log */
	private consoleLog (...args: any[]) {
		console.log(`ThreadedClass (${this.uniqueId})`, ...args)

	}
	/** Look up which instance contains a proxy, and return its instanceId */
	private findProxyInstanceOfChild (child: Child, proxy: ThreadedClass<any>): string | undefined {
		for (const instanceId of Object.keys(child.instances)) {
			let instance = child.instances[instanceId]

			if (instance.proxy === proxy) return instanceId
		}
		return undefined
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
