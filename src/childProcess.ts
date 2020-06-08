import { WorkerPlatformBase } from './workerPlatformBase'
import { ChildProcess, fork } from 'child_process'
import { MessageToChild } from './internalApi'

export function forkChildProcess (pathToWorker: string): ChildProcessWorker {
	return new ChildProcessWorker(pathToWorker)
}

export class ChildProcessWorker extends WorkerPlatformBase {
	private worker: ChildProcess

	constructor (path: string) {
		super()
		this.worker = fork(path)
		this.worker.on('message', (m) => this.emit('message', m))
		this.worker.on('close', () => this.emit('close'))
		this.worker.on('error', (e) => this.emit('error', e))
	}

	kill (): void {
		this.worker.kill()
	}
	send (m: MessageToChild): void {
		this.worker.send(m)
	}
}
