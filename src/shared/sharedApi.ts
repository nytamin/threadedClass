import { ThreadedClassConfig } from '../api'
import { ChildInstance } from '../parent-process/manager'

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
