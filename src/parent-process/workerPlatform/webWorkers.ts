import { Message } from '../../shared/sharedApi'
import { WorkerPlatformBase } from './_base'

/** Functions for emulating child-process in web-workers */

export class WebWorkerProcess extends WorkerPlatformBase {
	private worker: WebWorker

	constructor (pathToWorker: string) {
		super()

		try {
			// @ts-ignore
			this.worker = new window.Worker(pathToWorker)

			this.worker.onmessage = (message: any) => {
				if (message.type === 'message') {
					this.emit('message', message.data)
				} else console.log('unknown message type', message)
			}
			this.worker.onmessageerror = (error: any) => {
				console.error('ww message error', error)
			}
			this.worker.onerror = (error: any) => {
				console.error('ww error', error)
			}
		} catch (error) {
			let str = (error.stack || error).toString() + ''
			if (
				str.match(/cannot be accessed from origin/) &&
				str.match(/file:\/\//)
			) {
				throw Error('Unable to create Web-Worker. Not allowed to run from local file system.\n' + str)
			} else {
				throw error
			}
		}

		// this.worker.postMessage([first.value,second.value]); // Sending message as an array to the worker
	}

	kill (): void {
		this.worker.terminate()

		this.emit('close')
	}

	send (message: Message.To.Any): void {
		this.worker.postMessage(message)
	}
}
type WebWorker = any
export function forkWebWorker (pathToWorker: string): WebWorkerProcess {
	return new WebWorkerProcess(pathToWorker)

}
