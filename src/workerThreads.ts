import { Writable, Readable } from 'stream'
import { ChildProcess } from 'child_process'
import { EventEmitter } from 'events'

import { Worker as IWorker } from 'worker_threads'
import { getWorkerThreads } from './lib'

const WorkerThreads = getWorkerThreads()

/** Functions for spawning worker-threads in NodeJS */

export function forkWorkerThread (pathToWorker: string): WorkerThread {
	return new WorkerThread(pathToWorker)
}

export class WorkerThread extends EventEmitter implements ChildProcess {
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

	private worker: IWorker

	constructor (pathToWorker: string) {
		super()

		// @ts-ignore
		// this.worker = new window.Worker(pathToWorker)
		if (!WorkerThreads) throw new Error('Unable to create Worker thread! Not supported!')
		this.worker = new WorkerThreads.Worker(pathToWorker, {
			workerData: ''
		})
		this.worker.on('message', (message: any) => {
			this.emit('message', message)
			// if (message.type === 'message') {
			// } else console.log('unknown message type', message)
		})
		this.worker.on('error', (error: any) => {
			console.error('Worker Thread error', error)
		})
		this.worker.on('exit', (_code: number) => {
			this.emit('close')
		})
		this.worker.on('close', () => {
			this.emit('close')
		})
	}

	kill (): void {
		const p = this.worker.terminate()
		if (p) {
			p.then(() => {
				this.emit('close')
			}).catch((err: any) => {
				console.error('Worker Thread terminate failed', err)
			})
		} else {
			// If it didnt return a promise, then it as a blocking operation
			this.emit('close')
		}
		// throw new Error('Function kill in Worker Threads is not implemented.')
	}

	send (message: any) {
		this.worker.postMessage(message)
		// this.worker.onMessageFromParent(m)
		return true
	}

	disconnect (): void {
		throw new Error('Function disconnect in Worker Threads is not implemented.')
	}

	unref (): void {
		throw new Error('Function unref in Worker Threads is not implemented.')
	}

	ref (): void {
		throw new Error('Function ref in Worker Threads is not implemented.')
	}
}
