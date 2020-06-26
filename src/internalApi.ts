import { ThreadedClassConfig } from './api'
import { ChildInstance } from './manager'
import { isBrowser, nodeSupportsWorkerThreads } from './lib'
import isRunning = require('is-running')

export const DEFAULT_CHILD_FREEZE_TIME = 1000 // how long to wait before considering a child to be unresponsive

export type InitProps = Array<InitProp>
export enum InitPropType {
	FUNCTION = 'function',
	VALUE = 'value'
}
export interface InitPropDescriptor {
	/** If the property is a part of the prototype (and how many levels deep) */
	inProto: number
	// configurable: boolean
	enumerable: boolean
	/** If the property has a getter */
	get: boolean
	/** If the property has a setter */
	set: boolean
	/** If the property is writable */
	writable: boolean
	/** If the property is readable */
	readable: boolean
}
export interface InitProp {
	type: InitPropType
	key: string
	descriptor: InitPropDescriptor
}

export enum MessageType {
	INIT = 'init',
	PING = 'ping',
	FUNCTION = 'fcn',
	REPLY = 'reply',
	LOG = 'log',
	SET = 'set',
	KILL = 'kill',
	CALLBACK = 'callback'
}
export interface MessageSent {
	instanceId: string
	cmdId: number
}
export interface MessageInitConstr {
	cmd: MessageType.INIT
	modulePath: string
	exportName: string
	args: Array<ArgDefinition>
	config: ThreadedClassConfig
	parentPid: number
}
export type MessageInit = MessageInitConstr & MessageSent

export interface MessagePingConstr {
	cmd: MessageType.PING
}
export type MessagePing = MessagePingConstr & MessageSent

export interface MessageFcnConstr {
	cmd: MessageType.FUNCTION
	fcn: string
	args: Array<ArgDefinition>
}
export type MessageFcn = MessageFcnConstr & MessageSent

export interface MessageSetConstr {
	cmd: MessageType.SET
	property: string
	value: ArgDefinition
}
export type MessageSet = MessageSetConstr & MessageSent

export interface MessageReplyConstr {
	cmd: MessageType.REPLY
	replyTo: number
	reply?: any
	error?: Error | string
}
export type MessageReply = MessageReplyConstr & MessageSent

export interface MessageKillConstr {
	cmd: MessageType.KILL
}
export type MessageKill = MessageKillConstr & MessageSent

export interface MessageCallbackConstr {
	cmd: MessageType.CALLBACK
	callbackId: string
	args: Array<any>
}
export type MessageCallback = MessageCallbackConstr & MessageSent

export type MessageToChildConstr 	= MessageInitConstr | MessageFcnConstr 	| MessageReplyConstr 	| MessageSetConstr 	| MessageKillConstr | MessageCallbackConstr | MessagePingConstr
export type MessageToChild 			= MessageInit 		| MessageFcn 		| MessageReply 			| MessageSet 		| MessageKill		| MessageCallback		| MessagePing

export type MessageFromChildReplyConstr = MessageReplyConstr

export type MessageFromChildReply = MessageFromChildReplyConstr & MessageSent

export interface MessageFromChildLogConstr {
	cmd: MessageType.LOG
	log: Array<any>
}
export type MessageFromChildLog = MessageFromChildLogConstr & MessageSent

export type MessageFromChildCallbackConstr = MessageCallbackConstr
export type MessageFromChildCallback = MessageCallback

export type MessageFromChildConstr 	= MessageFromChildReplyConstr 	| MessageFromChildLogConstr | MessageFromChildCallbackConstr
export type MessageFromChild 		= MessageFromChildReply 		| MessageFromChildLog 		| MessageFromChildCallback

export type InstanceCallbackFunction = (instance: ChildInstance, e: Error | string | null, encodedResult?: ArgDefinition) => void
export type InstanceCallbackInitFunction = (instance: ChildInstance, e: Error | string | null, initProps?: InitProps) => boolean
export type CallbackFunction = (e: Error | string | null, res?: ArgDefinition) => void

export interface ArgDefinition {
	type: ArgumentType
	original?: any
	value: any
}
export enum ArgumentType {
	STRING = 'string',
	NUMBER = 'number',
	UNDEFINED = 'undefined',
	NULL = 'null',
	OBJECT = 'object',
	FUNCTION = 'function',
	BUFFER = 'buffer',
	OTHER = 'other'
}
export interface InstanceHandle {
	id: string
	cmdId: number
	queue: {[cmdId: string]: CallbackFunction}

	instance: any
}

export abstract class Worker {
	protected instanceHandles: {[instanceId: string]: InstanceHandle} = {}

	private callbacks: {[key: string]: Function} = {}

	protected disabledMultithreading: boolean = false

	private _parentPid: number = 0
	private _config?: ThreadedClassConfig

	protected abstract killInstance (handle: InstanceHandle): void

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

	protected reply (handle: InstanceHandle, m: MessageToChild, reply: any) {
		this.sendReplyToParent(handle, m.cmdId, undefined, reply)
	}
	protected replyError (handle: InstanceHandle, m: MessageToChild, error: any) {
		this.sendReplyToParent(handle, m.cmdId, error)
	}
	protected sendReplyToParent (handle: InstanceHandle, replyTo: number, error?: Error, reply?: any) {
		let msg: MessageFromChildReplyConstr = {
			cmd: MessageType.REPLY,
			replyTo: replyTo,
			error: error ? (error.stack || error).toString() : error,
			reply: reply
		}
		this.sendMessageToParent(handle, msg)
	}
	protected sendLog (log: any[]) {
		let msg: MessageFromChildLogConstr = {
			cmd: MessageType.LOG,
			log: log
		}
		this.sendMessageToParent(null, msg)
	}
	protected sendCallback (handle: InstanceHandle, callbackId: string, args: any[], cb: CallbackFunction) {
		let msg: MessageFromChildCallbackConstr = {
			cmd: MessageType.CALLBACK,
			callbackId: callbackId,
			args: args
		}
		this.sendMessageToParent(handle, msg, cb)
	}
	protected getAllProperties (obj: Object) {
		let props: Array<string> = []

		do {
			props = props.concat(Object.getOwnPropertyNames(obj))
			obj = Object.getPrototypeOf(obj)
		} while (obj)
		return props
	}
	log = (...data: any[]) => {
		this.sendLog(data)
	}
	logError = (...data: any[]) => {
		this.sendLog(['Error', ...data])
	}

	protected abstract sendMessageToParent (handle: InstanceHandle | null, msg: MessageFromChildConstr, cb?: CallbackFunction): void

	public onMessageFromParent (m: MessageToChild) {
		// A message was received from Parent
		let handle = this.instanceHandles[m.instanceId]
		if (!handle && m.cmd !== MessageType.INIT) {
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
			const instance = handle.instance

			if (m.cmd === MessageType.INIT) {
				const msg: MessageInit = m

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

			} else if (m.cmd === MessageType.PING) {
				this.reply(handle, m, null)
			} else if (m.cmd === MessageType.REPLY) {
				const msg: MessageReply = m
				let cb = handle.queue[msg.replyTo + '']
				if (!cb) throw Error(`cmdId "${msg.cmdId}" not found in instance ${m.instanceId}!`)
				if (msg.error) {
					cb(msg.error)
				} else {
					cb(null, msg.reply)
				}
				delete handle.queue[msg.replyTo + '']
			} else if (m.cmd === MessageType.FUNCTION) {
				// A function has been called by parent
				let msg: MessageFcn = m
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
			} else if (m.cmd === MessageType.SET) {
				let msg: MessageSet = m

				const fixedValue = this.decodeArgumentsFromParent(handle, [msg.value])[0]
				instance[msg.property] = fixedValue

				this.reply(handle, msg, fixedValue)
			} else if (m.cmd === MessageType.KILL) {
				let msg: MessageKill = m
				// kill off instance
				this.killInstance(handle)

				this.reply(handle, msg, null)
			} else if (m.cmd === MessageType.CALLBACK) {
				let msg: MessageCallback = m
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
		} catch (e) {

			if (m.cmdId) {
				this.replyError(handle, m, `Error: ${e.toString()} ${e.stack} on instance "${m.instanceId}"`)
			} else this.log('Error: ' + e.toString(), e.stack)
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
let argumentsCallbackId: number = 0
export function encodeArguments (instance: any, callbacks: {[key: string]: Function}, args: any[], disabledMultithreading: boolean): ArgDefinition[] {
	try {
		return args.map((arg, i): ArgDefinition => {
			try {

				if (typeof arg === 'object' && arg === instance) {
					return { type: ArgumentType.OBJECT, value: 'self' }
				}

				if (disabledMultithreading) {
					// In single-threaded mode, we can send the arguments directly, without any conversion:
					if (arg instanceof Buffer) return { type: ArgumentType.BUFFER, original: arg, value: null }
					if (typeof arg === 'object') return { type: ArgumentType.OBJECT, original: arg, value: null }
				}

				if (arg instanceof Buffer) return { type: ArgumentType.BUFFER, value: arg.toString('hex') }
				if (typeof arg === 'string') return { type: ArgumentType.STRING, value: arg }
				if (typeof arg === 'number') return { type: ArgumentType.NUMBER, value: arg }
				if (typeof arg === 'function') {
					const callbackId = argumentsCallbackId++
					callbacks[callbackId + ''] = arg
					return { type: ArgumentType.FUNCTION, value: callbackId + '' }
				}
				if (arg === undefined) return { type: ArgumentType.UNDEFINED, value: arg }
				if (arg === null) return { type: ArgumentType.NULL, value: arg }
				if (typeof arg === 'object') return { type: ArgumentType.OBJECT, value: arg }

				return { type: ArgumentType.OTHER, value: arg }
			} catch (e) {
				if (e.stack) e.stack += '\nIn encodeArguments, argument ' + i
				throw e
			}
		})
	} catch (e) {
		if (e.stack) e.stack += '\nThreadedClass, unsupported attribute'
		throw e
	}
}
export type ArgCallback = (...args: any[]) => Promise<any>
export function decodeArguments (instance: () => any, args: Array<ArgDefinition>, getCallback: (arg: ArgDefinition) => ArgCallback): Array<any | ArgCallback> {
	// Go through arguments and de-serialize them
	return args.map((a) => {
		if (a.original !== undefined) return a.original

		if (a.type === ArgumentType.STRING) return a.value
		if (a.type === ArgumentType.NUMBER) return a.value
		if (a.type === ArgumentType.BUFFER) return Buffer.from(a.value, 'hex')
		if (a.type === ArgumentType.UNDEFINED) return a.value
		if (a.type === ArgumentType.NULL) return a.value
		if (a.type === ArgumentType.FUNCTION) {
			return getCallback(a)
		}
		if (a.type === ArgumentType.OBJECT) {
			if (a.value === 'self') {
				return instance()
			} else {
				return a.value
			}
		}
		return a.value
	})
}
