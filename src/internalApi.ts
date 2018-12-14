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
