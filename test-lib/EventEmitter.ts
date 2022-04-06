import { EventEmitter } from 'eventemitter3'
import { EventEmitter as OrgEventEmitter } from 'events'

export type TypedEventEmitterEvents = {
	info: [arg0: string]
	details: [arg0: number, arg1: string]
}
export class TypedEventEmitter extends EventEmitter<TypedEventEmitterEvents> {

	constructor () {
		super()
	}
}

export class DefaultEventEmitter extends OrgEventEmitter {

	constructor () {
		super()
	}
}
