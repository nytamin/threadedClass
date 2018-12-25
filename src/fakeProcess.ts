import { ChildProcess, StdioStreams } from 'child_process'
import { Writable, Readable } from 'stream'
import { EventEmitter } from 'events'
import {
	MessageFromChild,
	CallbackFunction,
	MessageFromChildConstr,
	Worker,
	InstanceHandle
} from './internalApi'

export class FakeWorker extends Worker {
	private messageCb: (m: MessageFromChild) => void

	constructor (cb: (m: MessageFromChild) => void) {
		super()
		this.messageCb = cb
	}

	protected killInstance () {
		// throw new Error('Trying to kill a non threaded process!')
	}

	protected _orgConsoleLog (...args: any[]) {
		console.log(...args)
	}

	protected processSend (handle: InstanceHandle, msg: MessageFromChildConstr, cb?: CallbackFunction) {
		const message: MessageFromChild = {...msg, ...{
			cmdId: handle.cmdId++,
			instanceId: handle.id
		}}
		if (cb) handle.queue[message.cmdId + ''] = cb
		this.messageCb(message)
	}

}

export class FakeProcess extends EventEmitter implements ChildProcess {
	stdin: Writable
	stdout: Readable
	stderr: Readable
	stdio: StdioStreams
	killed: boolean = false
	pid: number = 0
	connected: boolean = true

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
		// throw new Error('Function kill in FakeProcess is not implemented.')
	}

	send (m: any) {
		this.worker.messageCallback(m)
		return true
	}

	disconnect (): void {
		throw new Error('Function disconnect in FakeProcess is not implemented.')
	}

	unref (): void {
		throw new Error('Function unref in FakeProcess is not implemented.')
	}

	ref (): void {
		throw new Error('Function ref in FakeProcess is not implemented.')
	}
}
