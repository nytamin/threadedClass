import { Worker as IWorker } from 'worker_threads'
import { EncodingStrategy, Message } from '../../shared/sharedApi'
import { getWorkerThreads } from '../../shared/lib'
import { WorkerPlatformBase } from './_base'

const WorkerThreads = getWorkerThreads()

/** Functions for spawning worker-threads in NodeJS */

export class WorkerThread extends WorkerPlatformBase {
	public override readonly encodingStrategy =
		EncodingStrategy.StructuredClone
	private worker: IWorker

	constructor (pathToWorker: string) {
		super()

		// @ts-ignore
		// this.worker = new window.Worker(pathToWorker)
		if (!WorkerThreads) {
			throw new Error('Unable to create Worker thread! Not supported!')
		}

		// No loader, so run the worker directly
		this.worker = new WorkerThreads.Worker(pathToWorker, {
			workerData: ''
		})

		this.worker.on('message', (message: any) => {
			this.emit('message', message)
			// if (message.type === 'message') {
			// } else console.log('unknown message type', message)
		})
		this.worker.on('messageerror', (error: any) => {
			this.emit('error', error)
		})
		this.worker.on('error', (error: any) => {
			this.emit('error', error)
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
	}

	send (message: Message.To.Any): void {
		this.worker.postMessage(message)
	}
}
export function forkWorkerThread (pathToWorker: string): WorkerThread {
	return new WorkerThread(pathToWorker)
}
