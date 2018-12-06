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
	SET = 'set'
}

export interface MessageInitConstr {
	modulePath: string,
	className: string,
	args: Array<any>,
}
export interface MessageInit extends MessageInitConstr {
	cmd: MessageType.INIT,
	cmdId: number
}
export interface MessageFcnConstr {
	fcn: string,
	args: Array<any>
}
export interface MessageFcn extends MessageFcnConstr {
	cmd: MessageType.FUNCTION,
	cmdId: number
}
export interface MessageSetConstr {
	property: string,
	value: any
}
export interface MessageSet extends MessageSetConstr {
	cmd: MessageType.SET,
	cmdId: number
}
export interface MessageReplyConstr {
	replyTo: number,
	reply?: any,
	error?: Error
}
export interface MessageReply extends MessageReplyConstr {
	cmd: MessageType.REPLY,
	cmdId: number,
}
export type MessageToChild = MessageInit | MessageFcn | MessageReply | MessageSet
export interface MessageFromChildReplyConstr {
	replyTo: number,
	error?: Error,
	reply?: any,
}
export interface MessageFromChildReply extends MessageFromChildReplyConstr {
	cmd: MessageType.REPLY
	cmdId: number,
}
export interface MessageFromChildLogConstr {
	log: Array<any>,
}
export interface MessageFromChildLog extends MessageFromChildLogConstr {
	cmd: MessageType.LOG
	cmdId: number,
}
export interface MessageFromChildCallbackConstr {
	callbackId: string,
	args: Array<any>
}
export interface MessageFromChildCallback extends MessageFromChildCallbackConstr {
	cmd: 'callback',
	cmdId: number,
}
export type MessageFromChild = MessageFromChildReply | MessageFromChildLog | MessageFromChildCallback
export type CallbackFunction = (e: Error | null, res?: any) => void
