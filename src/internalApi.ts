import { ThreadedClassConfig } from './api'
import { ChildInstance } from './manager'
import { isBrowser } from './lib'

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
	className: string
	classFunction?: Function // only used in single-thread mode
	args: Array<ArgDefinition>
	config: ThreadedClassConfig
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

	private _pingCount: number = 0
	private _config?: ThreadedClassConfig

	protected abstract killInstance (handle: InstanceHandle): void

	protected decodeArgumentsFromParent (handle: InstanceHandle, args: Array<ArgDefinition>) {
		return decodeArguments(handle.instance, args, (a: ArgDefinition) => {
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
								reject(Error('Bad reply from ' + msg.modulePath))
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
								return ${msg.className}
							}
						`
						// tslint:disable-next-line:no-eval
						let moduleClass = eval(fcn)()
						f = f
						if (!moduleClass) {
							throw Error(`${msg.className} not found in ${msg.modulePath}`)
						}
						return moduleClass
					})
				} else {
					pModuleClass = Promise.resolve(require(msg.modulePath))
					.then((module) => {
						return module[msg.className]
					})
				}

				pModuleClass
				.then((moduleClass) => {
					if (m.classFunction) {
						// In single thread mode.
						// When classFunction is provided, use that instead of the imported js file.
						return m.classFunction
					} else {
						return moduleClass
					}
				})
				.then((moduleClass) => {

					const handle: InstanceHandle = {
						id: msg.instanceId,
						cmdId: 0,
						queue: {},
						instance: ((...args: Array<any>) => {
							return new moduleClass(...args)
						}).apply(null, msg.args)
					}
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
				})
				.catch((e: any) => {
					console.log('INIT error', e)
				})

				if (!m.config.disableMultithreading) {
					this.startOrphanMonitoring()
				}

			} else if (m.cmd === MessageType.PING) {
				this._pingCount++
				this.reply(handle, m, null)
			} else if (m.cmd === MessageType.REPLY) {
				const msg: MessageReply = m
				let cb = handle.queue[msg.replyTo + '']
				if (!cb) throw Error('cmdId "' + msg.cmdId + '" not found!')
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
					this.replyError(handle, msg, err)
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
							this.replyError(handle, msg, err)
						})
					} catch (err) {
						this.replyError(handle, msg, err)
					}
				} else {
					this.replyError(handle, msg, 'callback "' + msg.callbackId + '" not found')
				}
			}
		} catch (e) {

			if (m.cmdId) this.replyError(handle, m, 'Error: ' + e.toString() + e.stack)
			else this.log('Error: ' + e.toString(), e.stack)
		}
	}
	private startOrphanMonitoring () {
		// expect our parent process to PING us now every and then
		// otherwise we consider ourselves to be orphaned
		// then we should exit the process

		if (this._config) {
			const pingTime: number = Math.max(
				500,
				this._config.freezeLimit || DEFAULT_CHILD_FREEZE_TIME
			)
			let missed: number = 0
			let previousPingCount: number = 0

			setInterval(() => {
				if (this._pingCount === previousPingCount) {
					// no ping has been received since last time
					missed++
				} else {
					missed = 0
				}
				previousPingCount = this._pingCount

				if (missed > 2) {
					// We've missed too many pings
					console.log(`Child missed ${missed} pings, exiting process!`)
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
export function decodeArguments (instance: any, args: Array<ArgDefinition>, getCallback: (arg: ArgDefinition) => ArgCallback): Array<any | ArgCallback> {
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
				return instance
			} else {
				return a.value
			}
		}
		return a.value
	})
}
