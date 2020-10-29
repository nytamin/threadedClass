
import { FakeWorker } from '../../child-process/fake-worker'
import { WorkerPlatformBase } from './_base'

export class FakeProcess extends WorkerPlatformBase {
	private worker: FakeWorker

	constructor () {
		super()
		this.worker = new FakeWorker((m) => {
			this.emit('message', m)
		})
	}

	kill (): void {
		// @todo: needs some implementation.
		this.emit('close')
	}

	send (m: any): void {
		this.worker.onMessageFromParent(m)
	}
}
