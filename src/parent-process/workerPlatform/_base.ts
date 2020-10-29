import { EventEmitter } from 'eventemitter3'
import { Message } from '../../shared/sharedApi'

export type WorkerPlatformBaseEvents = {
	message: (msg: Message.From.Any) => void
	close: () => void
	error: (err: any) => void
}
/** A sub-class of WorkerPlatformBase handles the communication with a child process */
export abstract class WorkerPlatformBase extends EventEmitter<WorkerPlatformBaseEvents> {
	abstract kill (): void

	abstract send (m: Message.To.Any): void
}
