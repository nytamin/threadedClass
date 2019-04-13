import { Writable, Readable } from 'stream'
import { ChildProcess } from 'child_process'
import { EventEmitter } from 'events'

/** Functions for emulating child-process in web-workers */

export function forkWebWorker (pathToWorker: string): WebWorkerProcess {
	return new WebWorkerProcess(pathToWorker)

}
type WebWorker = any

export class WebWorkerProcess extends EventEmitter implements ChildProcess {
	stdin: Writable
	stdout: Readable
	stderr: Readable
	readonly stdio: [
		Writable, // stdin
		Readable, // stdout
		Readable, // stderr
		Readable | Writable | null | undefined, // extra, no modification
		Readable | Writable | null | undefined // extra, no modification
	]
	killed: boolean = false
	pid: number = 0
	connected: boolean = true

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
		// throw new Error('Function kill in WebWorker is not implemented.')
	}

	send (message: any) {
		this.worker.postMessage(message)
		// this.worker.onMessageFromParent(m)
		return true
	}

	disconnect (): void {
		throw new Error('Function disconnect in WebWorker is not implemented.')
	}

	unref (): void {
		throw new Error('Function unref in WebWorker is not implemented.')
	}

	ref (): void {
		throw new Error('Function ref in WebWorker is not implemented.')
	}
}
