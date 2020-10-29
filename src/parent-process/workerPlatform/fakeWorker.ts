import { Message } from '../../shared/sharedApi'
import { WorkerPlatformBase } from './_base'
import { FakeWorker } from '../../child-process/fake-worker'

export class FakeProcess extends WorkerPlatformBase {
	private worker: FakeWorker

	constructor () {
		super()
		this._isFakeProcess = true
		this.worker = new FakeWorker((m: Message.From.Any) => {
			this.emit('message', m)
		})
	}

	kill (): void {
		// @todo: needs some implementation.
		this.emit('close')
	}

	send (m: Message.To.Any): void {
		this.worker.onMessageFromParent(m)
	}
}
