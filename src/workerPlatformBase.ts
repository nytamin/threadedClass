import { EventEmitter } from 'eventemitter3'
import { MessageFromChild, MessageToChild } from './internalApi'

export type WorkerPlatformBaseEvents = {
	message: (msg: MessageFromChild) => void
	close: () => void
	error: (err: any) => void
}

export abstract class WorkerPlatformBase extends EventEmitter<WorkerPlatformBaseEvents> {
	abstract kill (): void

	abstract send (m: MessageToChild): void
}
