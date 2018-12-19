import { ThreadedClassConfig } from './api'
import { ChildInstance } from './manager'

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
	args: Array<ArgDefinition>
	config: ThreadedClassConfig
}
export type MessageInit = MessageInitConstr & MessageSent

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
	error?: Error
}
export type MessageReply = MessageReplyConstr & MessageSent

export interface MessageKillConstr {
	cmd: MessageType.KILL
}
export type MessageKill = MessageKillConstr & MessageSent

export type MessageToChildConstr 	= MessageInitConstr | MessageFcnConstr 	| MessageReplyConstr 	| MessageSetConstr 	| MessageKillConstr
export type MessageToChild 			= MessageInit 		| MessageFcn 		| MessageReply 			| MessageSet 		| MessageKill

export interface MessageFromChildReplyConstr {
	cmd: MessageType.REPLY
	replyTo: number
	error?: Error
	reply?: any
}
export type MessageFromChildReply = MessageFromChildReplyConstr & MessageSent

export interface MessageFromChildLogConstr {
	cmd: MessageType.LOG
	log: Array<any>
}
export type MessageFromChildLog = MessageFromChildLogConstr & MessageSent

export interface MessageFromChildCallbackConstr {
	cmd: MessageType.CALLBACK
	callbackId: string
	args: Array<any>
}
export type MessageFromChildCallback = MessageFromChildCallbackConstr & MessageSent

export type MessageFromChildConstr 	= MessageFromChildReplyConstr 	| MessageFromChildLogConstr | MessageFromChildCallbackConstr
export type MessageFromChild 		= MessageFromChildReply 		| MessageFromChildLog 		| MessageFromChildCallback

export type InstanceCallbackFunction = (instance: ChildInstance, e: Error | null, res?: any) => void
export type CallbackFunction = (e: Error | null, res?: any) => void

export interface ArgDefinition {
	type: 'Buffer' | 'string' | 'number' | 'function' | 'other'
	value: any
}

export interface InstanceHandle {
	id: string
	cmdId: number
	queue: {[cmdId: string]: CallbackFunction}

	instance: any
}

export interface WorkerArguments {
	instanceHandles: {[instanceId: string]: InstanceHandle}
	fixArgs: (handle: InstanceHandle, args: Array<ArgDefinition>) => any
	reply: (handle: InstanceHandle, m: MessageToChild, reply: any) => void
	replyError: (handle: InstanceHandle, m: MessageToChild, error: any) => void
	log: (handle: InstanceHandle, ...data: any[]) => void
	getAllProperties: (obj: Object) => Array<string>
	_orgConsoleLog: (...args: any[]) => void
	killInstance: (handle: InstanceHandle) => void
}

export abstract class Worker {
	protected instanceHandles: {[instanceId: string]: InstanceHandle} = {}

	protected abstract killInstance (handle: InstanceHandle): void
	protected abstract fixArgs (handle: InstanceHandle, args: Array<ArgDefinition>): any
	protected abstract reply (handle: InstanceHandle, m: MessageToChild, reply: any): void
	protected abstract replyError (handle: InstanceHandle, m: MessageToChild, error: any): void
	protected abstract log (handle: InstanceHandle, ...data: any[]): void
	protected abstract getAllProperties (obj: Object): Array<string>
	protected abstract _orgConsoleLog (...args: any[]): void

	public messageCallback (m: MessageToChild) {
		let handle = this.instanceHandles[m.instanceId]
		if (!handle && m.cmd !== MessageType.INIT) {
			this._orgConsoleLog(`Child process: Unknown instanceId: "${m.instanceId}"`)
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
				const module = require(msg.modulePath)

				const handle: InstanceHandle = {
					id: msg.instanceId,
					cmdId: 0,
					queue: {},
					instance: ((...args: Array<any>) => {
						return new module[msg.className](...args)
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
					// console.log(prop, typeof instance[prop])

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
				let msg: MessageFcn = m
				if (instance[msg.fcn]) {

					const fixedArgs = this.fixArgs(handle, msg.args)

					let p = (
						typeof instance[msg.fcn] === 'function' ?
						instance[msg.fcn](...fixedArgs) :
						instance[msg.fcn]
					)
					if (typeof instance[msg.fcn] !== 'function' && fixedArgs.length === 1) {
						instance[msg.fcn] = fixedArgs[0]
					}
					Promise.resolve(p)
					.then((result) => {
						this.reply(handle, msg, result)
					})
					.catch((err) => {
						this.replyError(handle, msg, err)
					})
				} else {
					this.replyError(handle, msg, 'Function "' + msg.fcn + '" not found')
				}
			} else if (m.cmd === MessageType.SET) {
				let msg: MessageSet = m

				// _orgConsoleLog('msg')
				const fixedValue = this.fixArgs(handle, [msg.value])[0]
				instance[msg.property] = fixedValue

				this.reply(handle, msg, fixedValue)
			} else if (m.cmd === MessageType.KILL) {
				let msg: MessageKill = m
				// kill off instance
				this.killInstance(handle)

				this.reply(handle, msg, null)
			}
		} catch (e) {
			// _orgConsoleLog('error', e)

			if (m.cmdId) this.replyError(handle, m, 'Error: ' + e.toString() + e.stack)
			else this.log(handle, 'Error: ' + e.toString(), e.stack)
		}
	}
}
