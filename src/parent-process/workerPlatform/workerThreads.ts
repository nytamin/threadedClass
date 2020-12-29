import { Worker as IWorker } from 'worker_threads'
import { Message } from '../../shared/sharedApi'
import { getWorkerThreads } from '../../shared/lib'
import { WorkerPlatformBase } from './_base'
import { readFileSync } from 'fs'
import * as path from 'path'

const WorkerThreads = getWorkerThreads()

const DEFAULT_ELECTRON_LOADER = path.join(__dirname, '../../js/asar-loader.js')

/** Functions for spawning worker-threads in NodeJS */

export class WorkerThread extends WorkerPlatformBase {
	private worker: IWorker

	constructor (pathToWorker: string) {
		super()

		// @ts-ignore
		// this.worker = new window.Worker(pathToWorker)
		if (!WorkerThreads) throw new Error('Unable to create Worker thread! Not supported!')

		// Figure out the loader to use. This is to allow for some environment setup (eg require behaviour modification) before trying to run threadedClass
		let loader = process.env.THREADEDCLASS_WORKERTHREAD_LOADER
		if (!loader && Object.prototype.hasOwnProperty.call(process.versions, 'electron') && DEFAULT_ELECTRON_LOADER.indexOf('.asar/') !== -1) {
			loader = DEFAULT_ELECTRON_LOADER
		}

		if (loader) {
			// The WorkerThreads may will not be able to load this file, so we must do it in the parent
			const buf = readFileSync(loader)

			// Start the WorkerThread, passing pathToWorker so that the loader knows what it should execute
			this.worker = new WorkerThreads.Worker(buf.toString(), {
				workerData: pathToWorker,
				eval: true
			})
		} else {
			// No loader, so run the worker directly
			this.worker = new WorkerThreads.Worker(pathToWorker, {
				workerData: ''
			})
		}

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
	}

	send (message: Message.To.Any): void {
		this.worker.postMessage(message)
	}
}
export function forkWorkerThread (pathToWorker: string): WorkerThread {
	return new WorkerThread(pathToWorker)
}
