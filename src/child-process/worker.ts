import isRunning = require('is-running')
import { CallbackMap } from '../shared/callbackMap'
import {
	MemUsageReportInner,
	ThreadedClassConfig,
	WebWorkerMemoryUsage
} from '../api'
import { assertNever, combineErrorStacks, getErrorStack, isBrowser, nodeSupportsWorkerThreads, stripStack } from '../shared/lib'
import {
	ArgDefinition,
	decodeArguments,
	encodeArguments,
	Message,
	CallbackFunction,
	InitProps,
	InitPropDescriptor,
	InitPropType
} from '../shared/sharedApi'

/** In a child process, there is running one (1) Worker, which handles the communication with the parent process. */
export abstract class Worker {
	protected childHandler: ChildHandle = {
		cmdId: 0,
		queue: {}
	}
	protected instanceHandles: {[instanceId: string]: InstanceHandle} = {}

	private callbacks = new CallbackMap()
	private remoteFns: {[key: string]: { ref: WeakRef<(...args: any[]) => Promise<any>>; count: number }} = {}
	private finalizationRegistry = new FinalizationRegistry(this.finalizeRemoteFunction.bind(this))

	protected disabledMultithreading: boolean = false

	private _parentPid: number = 0
	private _config?: ThreadedClassConfig

	protected abstract killInstance (handle: InstanceHandle): void
	protected abstract sendInstanceMessageToParent (handle: InstanceHandle, msg: Message.From.Instance.AnyConstr, cb?: CallbackFunction): void
	protected abstract sendChildMessageToParent (handle: ChildHandle, msg: Message.From.Child.AnyConstr, cb?: CallbackFunction): void

	public onMessageFromParent (m: Message.To.Any) {
		// A message was received from Parent

		if (m.messageType === 'instance') {
			let handle: InstanceHandle = this.instanceHandles[m.instanceId]
			if (!handle && m.cmd !== Message.To.Instance.CommandType.INIT) {
				console.log(`Child process: Unknown instanceId: "${m.instanceId}"`)
				return // fail silently?
			}
			if (!handle) {
				// create temporary handle:
				handle = {
					id: m.instanceId,
					cmdId: 0,
					queue: {},
					instance: {}
				}
			}
			try {
				this.handleInstanceMessageFromParent(m, handle)
			} catch (e) {
				if (m.cmdId) {
					this.replyInstanceError(handle, m, `Error: ${e.toString()} ${e.stack} thrown in handleInstanceMessageFromParent on instance "${m.instanceId}"`)
				} else this.log('Error: ' + e.toString(), e.stack)
			}
		} else if (m.messageType === 'child') {
			let handle: ChildHandle = this.childHandler

			try {
				this.handleChildMessageFromParent(m, handle)
			} catch (e) {
				if (m.cmdId) {
					this.replyChildError(handle, m, `Error: ${e.toString()} ${e.stack} thrown in handleChildMessageFromParent on child`)
				} else this.log('Error: ' + e.toString(), e.stack)
			}
		}
	}

	public log = (...data: any[]) => {
		this.sendLog(data)
	}
	public logError = (...data: any[]) => {
		this.sendLog(['Error', ...data])
	}

	private decodeArgumentsFromParent (handle: InstanceHandle, args: Array<ArgDefinition>) {
		// Note: handle.instance could change if this was called for the constructor parameters, so it needs to be loose
		return decodeArguments(() => handle.instance, args, (a: ArgDefinition) => {
			const callbackId = a.value[0]
			const count = a.value[1]

			let callback = this.remoteFns[callbackId]?.ref.deref()

			if (!callback) {
				callback = ((...args: any[]) => {
					const orgError = new Error()
					return new Promise((resolve, reject) => {
						const callbackId = a.value[0]
						this.sendCallback(
							handle,
							callbackId,
							args,
							(err, encodedResult) => {
								if (err) {

									const errStack = stripStack(getErrorStack(err), [
										/[\\/]parent-process[\\/]manager/,
										/[\\/]eventemitter3[\\/]index/
									])
									const orgStack = (orgError.stack + '')
										.split('\n')
										.slice(2) // Remove the first two lines, since they are internal to ThreadedClass
										.join('\n')

									reject(combineErrorStacks(errStack, orgStack))
									// reject(err)
								} else {
									const result = encodedResult ? this.decodeArgumentsFromParent(handle, [encodedResult]) : [encodedResult]
									resolve(result[0])
								}
							}
						)
					})
				})

				this.remoteFns[callbackId] = { ref: new WeakRef(callback), count }
				this.finalizationRegistry.register(callback, callbackId)
			} else {
				this.remoteFns[callbackId].count = count
			}

			return callback
		})
	}
	private encodeArgumentsToParent (instance: any, args: any[]): ArgDefinition[] {
		return encodeArguments(instance, this.callbacks, args, this.disabledMultithreading)
	}
	private replyToInstanceMessage (handle: InstanceHandle, messageToReplyTo: Message.To.Instance.Any, reply: any) {
		this.sendInstanceReplyToParent(handle, messageToReplyTo.cmdId, undefined, reply)
	}
	private replyToChildMessage (handle: ChildHandle, messageToReplyTo: Message.To.Child.Any, reply: any) {
		this.sendChildReplyToParent(handle, messageToReplyTo.cmdId, undefined, reply)
	}
	private replyInstanceError (handle: InstanceHandle, messageToReplyTo: Message.To.Instance.Any, error: any) {
		this.sendInstanceReplyToParent(handle, messageToReplyTo.cmdId, error)
	}
	private replyChildError (handle: ChildHandle, messageToReplyTo: Message.To.Child.Any, error: any) {
		this.sendChildReplyToParent(handle, messageToReplyTo.cmdId, error)
	}
	private sendInstanceReplyToParent (handle: InstanceHandle, replyTo: number, error?: Error, reply?: any) {
		let msg: Message.From.Instance.ReplyConstr = {
			cmd: Message.From.Instance.CommandType.REPLY,
			replyTo: replyTo,
			error: error ? (error.stack || error).toString() : error,
			reply: reply
		}
		this.sendInstanceMessageToParent(handle, msg)
	}
	private sendChildReplyToParent (handle: ChildHandle, replyTo: number, error?: Error, reply?: any) {
		let msg: Message.From.Child.ReplyConstr = {
			cmd: Message.From.Child.CommandType.REPLY,
			replyTo: replyTo,
			error: error ? (error.stack || error).toString() : error,
			reply: reply
		}
		this.sendChildMessageToParent(handle, msg)
	}
	private sendLog (log: any[]) {
		let msg: Message.From.Child.LogConstr = {
			cmd: Message.From.Child.CommandType.LOG,
			log: log
		}
		this.sendChildMessageToParent(this.childHandler, msg)
	}
	private sendCallback (handle: InstanceHandle, callbackId: string, args: any[], cb: CallbackFunction) {
		let msg: Message.From.Instance.CallbackConstr = {
			cmd: Message.From.Instance.CommandType.CALLBACK,
			callbackId: callbackId,
			args: args
		}
		this.sendInstanceMessageToParent(handle, msg, cb)
	}
	private sendCallbackFinalize (handle: ChildHandle, callbackId: string, count: number) {
		let msg: Message.From.Child.CallbackFinalizeConstr = {
			cmd: Message.From.Child.CommandType.CALLBACK_FINALIZE,
			callbackId,
			count
		}
		this.sendChildMessageToParent(handle, msg)
	}
	private getAllProperties (obj: Object) {
		let props: Array<string> = []

		do {
			props = props.concat(Object.getOwnPropertyNames(obj))
			obj = Object.getPrototypeOf(obj)
		} while (obj)
		return props
	}
	private handleInstanceMessageFromParent (m: Message.To.Instance.Any, handle: InstanceHandle) {
		const instance = handle.instance
		if (m.cmd === Message.To.Instance.CommandType.INIT) {
			// This is the initial message sent from the parent process upon initialization.

			const msg: Message.To.Instance.Init = m

			this._config = m.config
			this._parentPid = m.parentPid

			let pModuleClass: Promise<any>

			// Load in the class:

			if (isBrowser()) {
				pModuleClass = new Promise((resolve, reject) => {
					// @ts-ignore
					let oReq = new XMLHttpRequest()
					oReq.open('GET', msg.modulePath, true)
					// oReq.responseType = 'blob'
					oReq.onload = () => {
						if (oReq.response) {
							resolve(oReq.response)
						} else {
							reject(Error(`Bad reply from ${msg.modulePath} in instance ${handle.id}`))
						}
					}
					oReq.send()
				})
				.then((bodyString: string) => {

					// This is a terrible hack, I'm ashamed of myself.
					// Better solutions are very much appreciated.

					// tslint:disable-next-line:no-var-keyword
					var f: any = null
					let fcn: string = `
						f = function() {
							${bodyString}
							;
							return ${msg.exportName}
						}
					`
					// tslint:disable-next-line:no-eval
					let moduleClass = eval(fcn)()
					f = f
					if (!moduleClass) {
						throw Error(`${msg.exportName} not found in ${msg.modulePath}`)
					}
					return moduleClass
				})
			} else {
				pModuleClass = Promise.resolve(require(msg.modulePath))
				.then((module) => {
					return module[msg.exportName]
				})
			}

			pModuleClass
			.then((moduleClass) => {
				if (!moduleClass) {
					return Promise.reject('Failed to find class')
				}

				const handle: InstanceHandle = {
					id: msg.instanceId,
					cmdId: 0,
					queue: {},
					instance: null // Note: This is dangerous, but gets set right after.
				}
				const decodedArgs = this.decodeArgumentsFromParent(handle, msg.args)
				handle.instance = ((...args: Array<any>) => {
					return new moduleClass(...args)
				}).apply(null, decodedArgs)

				this.instanceHandles[handle.id] = handle

				const instance = handle.instance

				const allProps = this.getAllProperties(instance)
				const props: InitProps = []
				allProps.forEach((prop: string) => {
					if ([
						'constructor',
						'__defineGetter__',
						'__defineSetter__',
						'hasOwnProperty',
						'__lookupGetter__',
						'__lookupSetter__',
						'isPrototypeOf',
						'propertyIsEnumerable',
						'toString',
						'valueOf',
						'__proto__',
						'toLocaleString'
					].indexOf(prop) !== -1) return

					let descriptor = Object.getOwnPropertyDescriptor(instance, prop)
					let inProto: number = 0
					let proto = instance.__proto__
					while (!descriptor) {
						if (!proto) break
						descriptor = Object.getOwnPropertyDescriptor(proto, prop)
						inProto++
						proto = proto.__proto__
					}

					if (!descriptor) descriptor = {}

					let descr: InitPropDescriptor = {
						// configurable:	!!descriptor.configurable,
						inProto: 		inProto,
						enumerable:		!!descriptor.enumerable,
						writable:		!!descriptor.writable,
						get:			!!descriptor.get,
						set:			!!descriptor.set,
						readable:		!!(!descriptor.get && !descriptor.get) // if no getter or setter, ie an ordinary property
					}

					if (typeof instance[prop] === 'function') {
						props.push({
							key: prop,
							type: InitPropType.FUNCTION,
							descriptor: descr
						})
					} else {
						props.push({
							key: prop,
							type: InitPropType.VALUE,
							descriptor: descr
						})
					}
				})
				this.replyToInstanceMessage(handle, msg, props)
				return
			})
			.catch((err: any) => {
				const errStack = stripStack(err.stack || err.toString(), [
					/onMessageFromParent/,
					/threadedclass-worker/
				])

				let errorResponse: string = `${errStack}\n executing constructor of instance "${m.instanceId}"`
				this.replyInstanceError(handle, msg, errorResponse)
				return
			})

			if (!m.config.disableMultithreading && !nodeSupportsWorkerThreads()) {
				this.startOrphanMonitoring()
			}

		} else if (m.cmd === Message.To.Instance.CommandType.PING) {
			// This is a message from the parent process. It's just a ping, used to check if this instance is alive.
			this.replyToInstanceMessage(handle, m, null)

		} else if (m.cmd === Message.To.Instance.CommandType.REPLY) {
			// A reply to an earlier message.

			const msg: Message.To.Instance.Reply = m
			let cb = handle.queue[msg.replyTo + '']
			if (!cb) throw Error(`cmdId "${msg.cmdId}" not found in instance ${m.instanceId}!`)
			if (msg.error) {
				cb.cb(msg.error)
			} else {
				cb.cb(null, msg.reply)
			}
			delete handle.queue[msg.replyTo + '']
		} else if (m.cmd === Message.To.Instance.CommandType.FUNCTION) {
			// A function/method has been called by the parent
			let msg: Message.To.Instance.Fcn = m
			const fixedArgs = this.decodeArgumentsFromParent(handle, msg.args)

			let p: any
			try {
				if (typeof instance[msg.fcn] === 'function') {
					p = instance[msg.fcn](...fixedArgs)
				} else {
					// in case instance[msg.fcn] does not exist, it will simply resolve to undefined
					p = instance[msg.fcn]
				}
			} catch (error) {
				p = Promise.reject(error)
			}

			Promise.resolve(p)
			.then((result) => {
				const encodedResult = this.encodeArgumentsToParent(instance, [result])
				this.replyToInstanceMessage(handle, msg, encodedResult[0])
			})
			.catch((err) => {

				const errStack = stripStack(err.stack || err.toString(), [
					/onMessageFromParent/,
					/threadedclass-worker/
				])

				let errorResponse: string = `${errStack}\n executing function "${msg.fcn}" of instance "${m.instanceId}"`
				this.replyInstanceError(handle, msg, errorResponse)
			})
		} else if (m.cmd === Message.To.Instance.CommandType.SET) {
			// A setter has been called by the parent

			let msg: Message.To.Instance.Set = m

			const fixedValue = this.decodeArgumentsFromParent(handle, [msg.value])[0]
			instance[msg.property] = fixedValue

			const encodedResult = this.encodeArgumentsToParent(instance, [fixedValue])
			this.replyToInstanceMessage(handle, msg, encodedResult[0])
		} else if (m.cmd === Message.To.Instance.CommandType.KILL) {
			// A Kill-command has been sent by the parent.

			let msg: Message.To.Instance.Kill = m
			// kill off instance
			this.killInstance(handle)

			this.replyToInstanceMessage(handle, msg, null)
		} else if (m.cmd === Message.To.Instance.CommandType.CALLBACK) {
			// A callback has been called by the parent.
			// A "callback" is a function that has been sent to the parent process from the child instance.

			let msg: Message.To.Instance.Callback = m
			let callback = this.callbacks.get(msg.callbackId)
			if (callback) {
				try {
					Promise.resolve(callback.fun(...msg.args))
					.then((result: any) => {
						const encodedResult = this.encodeArgumentsToParent(instance, [result])
						this.replyToInstanceMessage(handle, msg, encodedResult[0])
					})
					.catch((err: Error) => {
						let errorResponse: string = (err.stack || err.toString()) + `\n executing callback of instance "${m.instanceId}"`
						this.replyInstanceError(handle, msg, errorResponse)
					})
				} catch (err) {
					let errorResponse: string = (err.stack || err.toString()) + `\n executing (outer) callback of instance "${m.instanceId}"`
					this.replyInstanceError(handle, msg, errorResponse)
				}
			} else {
				this.replyInstanceError(handle, msg, `Callback "${msg.callbackId}" not found on instance "${m.instanceId}"`)
			}
		} else {
			assertNever(m)
		}
	}
	private handleChildMessageFromParent (m: Message.To.Child.Any, handle: ChildHandle) {
		if (m.cmd === Message.To.Child.CommandType.GET_MEM_USAGE) {

			let memUsage: MemUsageReportInner = (
				process ?
				process.memoryUsage() :
				// @ts-ignore web-worker global window
				window ?
				// @ts-ignore web-worker global window
				window.performance.memory as WebWorkerMemoryUsage :
				{ error: 'N/A' }
			)
			const encodedResult = this.encodeArgumentsToParent({}, [memUsage])[0]
			this.replyToChildMessage(handle, m, encodedResult)
		} else if (m.cmd === Message.To.Child.CommandType.CALLBACK_FINALIZE) {
			let msg: Message.To.Child.CallbackFinalize = m
			const currentCallback = this.callbacks.get(msg.callbackId)
			if (currentCallback && msg.count >= currentCallback.count) {
				this.callbacks.delete(msg.callbackId)
			}
		}
	}
	private startOrphanMonitoring () {
		if (this._config) {
			const pingTime: number = 5000

			setInterval(() => {
				if (this._parentPid && !isRunning(this._parentPid)) {
					console.log(`Parent pid ${this._parentPid} missing, exiting process!`)
					setTimeout(() => {
						process.exit(27)
					}, 100)
				}
			}, pingTime)
		}
	}
	private finalizeRemoteFunction (callbackId: string) {
		const remoteFun = this.remoteFns[callbackId]
		if (!remoteFun?.ref.deref()) {
			this.sendCallbackFinalize(this.childHandler, callbackId, remoteFun.count)
			delete this.remoteFns[callbackId]
		}
	}
}

export interface MessageHandle {
	cmdId: number
	queue: {[cmdId: string]: {
		traceError?: Error
		cb: CallbackFunction
	}}
}
export interface InstanceHandle extends MessageHandle {
	id: string
	instance: any
}
export interface ChildHandle extends MessageHandle {
}
