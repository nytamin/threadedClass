import isRunning = require('is-running')
import { ThreadedClassConfig } from '../api'
import { isBrowser, nodeSupportsWorkerThreads } from '../shared/lib'
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
	protected instanceHandles: {[instanceId: string]: InstanceHandle} = {}

	private callbacks: {[key: string]: Function} = {}

	protected disabledMultithreading: boolean = false

	private _parentPid: number = 0
	private _config?: ThreadedClassConfig

	protected abstract killInstance (handle: InstanceHandle): void
	protected abstract sendInstanceMessageToParent (handle: InstanceHandle | null, msg: Message.From.Instance.AnyConstr, cb?: CallbackFunction): void

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
				this.handleMessageFromParent(m, handle)
			} catch (e) {
				if (m.cmdId) {
					this.replyError(handle, m, `Error: ${e.toString()} ${e.stack} on instance "${m.instanceId}"`)
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

	protected decodeArgumentsFromParent (handle: InstanceHandle, args: Array<ArgDefinition>) {
		// Note: handle.instance could change if this was called for the constructor parameters, so it needs to be loose
		return decodeArguments(() => handle.instance, args, (a: ArgDefinition) => {
			return ((...args: any[]) => {
				return new Promise((resolve, reject) => {
					const callbackId = a.value
					this.sendCallback(
						handle,
						callbackId,
						args,
						(err, encodedResult) => {
							if (err) {
								reject(err)
							} else {
								const result = encodedResult ? this.decodeArgumentsFromParent(handle, [encodedResult]) : [encodedResult]
								resolve(result[0])
							}
						}
					)
				})
			})
		})
	}
	protected encodeArgumentsToParent (instance: any, args: any[]): ArgDefinition[] {
		return encodeArguments(instance, this.callbacks, args, this.disabledMultithreading)
	}
	protected reply (handle: InstanceHandle, m: Message.To.Instance.Any, reply: any) {
		this.sendReplyToParent(handle, m.cmdId, undefined, reply)
	}
	protected replyError (handle: InstanceHandle, m: Message.To.Instance.Any, error: any) {
		this.sendReplyToParent(handle, m.cmdId, error)
	}
	protected sendReplyToParent (handle: InstanceHandle, replyTo: number, error?: Error, reply?: any) {
		let msg: Message.From.Instance.ReplyConstr = {
			cmd: Message.From.Instance.CommandType.REPLY,
			replyTo: replyTo,
			error: error ? (error.stack || error).toString() : error,
			reply: reply
		}
		this.sendInstanceMessageToParent(handle, msg)
	}
	protected sendLog (log: any[]) {
		let msg: Message.From.Instance.LogConstr = {
			cmd: Message.From.Instance.CommandType.LOG,
			log: log
		}
		this.sendInstanceMessageToParent(null, msg)
	}
	protected sendCallback (handle: InstanceHandle, callbackId: string, args: any[], cb: CallbackFunction) {
		let msg: Message.From.Instance.CallbackConstr = {
			cmd: Message.From.Instance.CommandType.CALLBACK,
			callbackId: callbackId,
			args: args
		}
		this.sendInstanceMessageToParent(handle, msg, cb)
	}
	protected getAllProperties (obj: Object) {
		let props: Array<string> = []

		do {
			props = props.concat(Object.getOwnPropertyNames(obj))
			obj = Object.getPrototypeOf(obj)
		} while (obj)
		return props
	}
	protected handleMessageFromParent (m: Message.To.Instance.Any, handle: InstanceHandle) {
		const instance = handle.instance
		if (m.cmd === Message.To.Instance.CommandType.INIT) {
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
				this.reply(handle, msg, props)
				return
			})
			.catch((e: any) => {
				console.log('INIT error', e)
			})

			if (!m.config.disableMultithreading && !nodeSupportsWorkerThreads()) {
				this.startOrphanMonitoring()
			}

		} else if (m.cmd === Message.To.Instance.CommandType.PING) {
			this.reply(handle, m, null)
		} else if (m.cmd === Message.To.Instance.CommandType.REPLY) {
			const msg: Message.To.Instance.Reply = m
			let cb = handle.queue[msg.replyTo + '']
			if (!cb) throw Error(`cmdId "${msg.cmdId}" not found in instance ${m.instanceId}!`)
			if (msg.error) {
				cb(msg.error)
			} else {
				cb(null, msg.reply)
			}
			delete handle.queue[msg.replyTo + '']
		} else if (m.cmd === Message.To.Instance.CommandType.FUNCTION) {
			// A function has been called by parent
			let msg: Message.To.Instance.Fcn = m
			const fixedArgs = this.decodeArgumentsFromParent(handle, msg.args)

			let p = (
				typeof instance[msg.fcn] === 'function' ?
				instance[msg.fcn](...fixedArgs) :
				instance[msg.fcn]
			) // in case instance[msg.fcn] does not exist, it will simply resolve to undefined on the consumer side
			Promise.resolve(p)
			.then((result) => {
				const encodedResult = this.encodeArgumentsToParent(instance, [result])
				this.reply(handle, msg, encodedResult[0])
			})
			.catch((err) => {

				let errorResponse: string = (err.stack || err.toString()) + `\n executing function "${msg.fcn}" of instance "${m.instanceId}"`
				this.replyError(handle, msg, errorResponse)
			})
		} else if (m.cmd === Message.To.Instance.CommandType.SET) {
			let msg: Message.To.Instance.Set = m

			const fixedValue = this.decodeArgumentsFromParent(handle, [msg.value])[0]
			instance[msg.property] = fixedValue

			this.reply(handle, msg, fixedValue)
		} else if (m.cmd === Message.To.Instance.CommandType.KILL) {
			let msg: Message.To.Instance.Kill = m
			// kill off instance
			this.killInstance(handle)

			this.reply(handle, msg, null)
		} else if (m.cmd === Message.To.Instance.CommandType.CALLBACK) {
			let msg: Message.To.Instance.Callback = m
			let callback = this.callbacks[msg.callbackId]
			if (callback) {
				try {
					Promise.resolve(callback(...msg.args))
					.then((result: any) => {
						const encodedResult = this.encodeArgumentsToParent(instance, [result])
						this.reply(handle, msg, encodedResult[0])
					})
					.catch((err: Error) => {
						let errorResponse: string = (err.stack || err.toString()) + `\n executing callback of instance "${m.instanceId}"`
						this.replyError(handle, msg, errorResponse)
					})
				} catch (err) {
					let errorResponse: string = (err.stack || err.toString()) + `\n executing (outer) callback of instance "${m.instanceId}"`
					this.replyError(handle, msg, errorResponse)
				}
			} else {
				this.replyError(handle, msg, `Callback "${msg.callbackId}" not found on instance "${m.instanceId}"`)
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
}

export interface InstanceHandle {
	cmdId: number
	queue: {[cmdId: string]: CallbackFunction}
	id: string
	instance: any
}
