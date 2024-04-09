import { ThreadedClassConfig } from '../api'
import { CallbackMap } from './callbackMap'

// This file contains definitions for the API between the child and parent process.

export const DEFAULT_CHILD_FREEZE_TIME = 1000 // how long to wait before considering a child to be unresponsive
export const DEFAULT_RESTART_TIMEOUT = 1000 // how long to wait for the child to come back after restart
export const DEFAULT_KILL_TIMEOUT = 1000 // how long to wait for the thread to close when terminating it
export const DEFAULT_AUTO_RESTART_RETRY_COUNT = 1 // after how many failed restarts to give up
export const DEFAULT_AUTO_RESTART_RETRY_DELAY = 1000 // how long to wait before retrying a failed restart

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
// Messages to/from child instances ------------------------------------------------

/** Definitions of all messages between the child and parent */
export namespace Message {
	interface Base {
		messageType: 'instance' | 'child'
		cmdId: number
	}
	export interface InstanceBase extends Base {
		messageType: 'instance'
		instanceId: string
	}
	export interface ChildBase extends Base {
		messageType: 'child'
	}

	/** Containes definitions of messages sent from the parent process */
	export namespace To {
		export type Any = Instance.Any | Child.Any
		export type AnyConstr = Instance.AnyConstr | Child.AnyConstr

		/** Defines messages sent from the parent process to the child instance */
		export namespace Instance {

			export type AnyConstr 	= InitConstr 	| FcnConstr 	| ReplyConstr 	| SetConstr | KillConstr 	| CallbackConstr 	| PingConstr
			export type Any 		= Init 			| Fcn 			| Reply 		| Set 		| Kill			| Callback			| Ping

			export enum CommandType {
				INIT = 'init',
				PING = 'ping',
				FUNCTION = 'fcn',
				REPLY = 'reply',
				SET = 'set',
				KILL = 'kill',
				CALLBACK = 'callback'
			}

			export interface InitConstr {
				cmd: CommandType.INIT
				modulePath: string
				exportName: string
				args: Array<ArgDefinition>
				config: ThreadedClassConfig
				parentPid: number
			}
			/**
			 * Initial message from parent to the child instance.
			 * Child instance will reply with InitProps.
			 * @see InitProps
			 */
			export type Init = InitConstr & InstanceBase
			/**  */
			export interface PingConstr {
				cmd: CommandType.PING
			}
			/**
			 * Just a ping, used to check if the child instance is alive.
			 * Child instance will reply with null.
			 */
			export type Ping = PingConstr & InstanceBase

			export interface FcnConstr {
				cmd: CommandType.FUNCTION
				fcn: string
				args: Array<ArgDefinition>
			}
			/**
			 * Sent from parent process to child instance.
			 * Calls a function/method on the child instance.
			 * Child instance will reply with the result of the function call.
			 */
			export type Fcn = FcnConstr & InstanceBase

			export interface SetConstr {
				cmd: CommandType.SET
				property: string
				value: ArgDefinition
			}
			/**
			 * Sent from parent process to child instance.
			 * Sets a property on the child instance.
			 * Child instance will reply with the set value
			 */
			export type Set = SetConstr & InstanceBase

			export interface ReplyConstr {
				cmd: CommandType.REPLY
				replyTo: number
				reply?: any
				error?: Error | string
			}
			/**
			 * Sent from parent process to child instance.
			 * Contains a reply to a previous message sent from the child instance to the parent process.
			 */
			export type Reply = ReplyConstr & InstanceBase

			export interface KillConstr {
				cmd: CommandType.KILL
			}
			/**
			 * Sent from parent process to child instance.
			 * A Kill command
			 * Child instance will reply with null.
			 */
			export type Kill = KillConstr & InstanceBase

			export interface CallbackConstr {
				cmd: CommandType.CALLBACK
				callbackId: string
				args: Array<any>
			}
			/**
			 * Sent from parent process to child instance.
			 * Calling a callback function. A "callback" is a function that has been sent to the parent process from the child instance.
			 * Child instance will reply with null.
			 */
			export type Callback = CallbackConstr & InstanceBase
		}
		/** Defines messages sent from the parent process to the child process */
		export namespace Child {
			export type AnyConstr	= ReplyConstr 	| GetMemUsageConstr	| CallbackFinalizeConstr
			export type Any			= Reply 		| GetMemUsage		| CallbackFinalize

			export enum CommandType {
				GET_MEM_USAGE = 'get_mem_usage',
				REPLY = 'reply',
				CALLBACK_FINALIZE = 'callback_finalize'
			}

			export interface GetMemUsageConstr {
				cmd: CommandType.GET_MEM_USAGE
			}
			export type GetMemUsage = GetMemUsageConstr & ChildBase

			export interface ReplyConstr {
				cmd: CommandType.REPLY
				replyTo: number
				reply?: any
				error?: Error | string
			}
			export type Reply = ReplyConstr & ChildBase

			export interface CallbackFinalizeConstr {
				cmd: CommandType.CALLBACK_FINALIZE
				callbackId: string
				count: number
			}
			export type CallbackFinalize = CallbackFinalizeConstr & ChildBase
		}
	}
	/** Containes definitions of messages sent from the child process */
	export namespace From {
		export type Any = Instance.Any | Child.Any
		export type AnyConstr = Instance.AnyConstr | Child.AnyConstr
		/** Defines messages sent from the child instance to the parent process */
		export namespace Instance {
			export enum CommandType {
				CALLBACK = 'callback',
				REPLY = 'reply'
			}

			export interface CallbackConstr {
				cmd: CommandType.CALLBACK
				callbackId: string
				args: Array<any>
			}
			export type Callback = CallbackConstr & InstanceBase

			export interface ReplyConstr {
				cmd: CommandType.REPLY
				replyTo: number
				reply?: any
				error?: Error | string
			}
			export type Reply = ReplyConstr & InstanceBase

			export type AnyConstr 	= ReplyConstr 	| CallbackConstr
			export type Any 		= Reply 		| Callback
		}
		/** Defines messages sent from the child process to the parent process */
		export namespace Child {
			export enum CommandType {
				LOG = 'log',
				REPLY = 'reply',
				CALLBACK = 'callback',
				CALLBACK_FINALIZE = 'callback_finalize'
			}

			export interface LogConstr {
				cmd: CommandType.LOG
				log: Array<any>
			}
			export type Log = LogConstr & ChildBase

			export interface ReplyConstr {
				cmd: CommandType.REPLY
				replyTo: number
				reply?: any
				error?: Error | string
			}
			export type Reply = ReplyConstr & ChildBase

			export interface CallbackConstr {
				cmd: CommandType.CALLBACK
				callbackId: string
				args: Array<any>
			}
			export type Callback = CallbackConstr & ChildBase

			export interface CallbackFinalizeConstr {
				cmd: CommandType.CALLBACK_FINALIZE
				callbackId: string
				count: number
			}
			export type CallbackFinalize = CallbackFinalizeConstr & ChildBase

			export type AnyConstr 	= ReplyConstr 	| CallbackConstr 	| LogConstr 	| CallbackFinalizeConstr
			export type Any 		= Reply			| Callback			| Log			| CallbackFinalize
		}
	}
}

export type CallbackFunction = (e: Error | string | null, res?: ArgDefinition) => void

export interface ArgDefinition {
	type: ArgumentType
	original?: any
	value: any
}
enum ArgumentType {
	STRING = 'string',
	NUMBER = 'number',
	UNDEFINED = 'undefined',
	NULL = 'null',
	OBJECT = 'object',
	FUNCTION = 'function',
	BUFFER = 'buffer',
	OTHER = 'other'
}

let argumentsCallbackId: number = 0
export function encodeArguments (instance: any, callbacks: CallbackMap, args: any[], disabledMultithreading: boolean): ArgDefinition[] {
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
					// have we seen this one before?
					const existingCallback = callbacks.get(arg)
					if (existingCallback) {
						return { type: ArgumentType.FUNCTION, value: [ existingCallback.id, ++existingCallback.count ] }
					}
					// new function, so add it to our list
					const callbackId = (argumentsCallbackId++).toString()
					callbacks.insert(callbackId, arg, 0)
					return { type: ArgumentType.FUNCTION, value: [ callbackId, 0 ] }
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
