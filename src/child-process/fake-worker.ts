import {
	CallbackFunction,
	Message
} from '../shared/sharedApi'
import {
	InstanceHandle,
	Worker
} from './worker'

// This code is actually not run in a child process, but in the parent process
// (it's used when multithreading is turned off.)

// All code in this file should still be considered to be sandboxed in the "virtual child process".

export class FakeWorker extends Worker {
	private mockProcessSend: (m: Message.From.Any) => void

	constructor (cb: (m: Message.From.Any) => void) {
		super()
		this.disabledMultithreading = true
		this.mockProcessSend = cb
	}

	protected killInstance () {
		// throw new Error('Trying to kill a non threaded process!')
	}

	protected sendInstanceMessageToParent (handle: InstanceHandle, msg: Message.From.Instance.AnyConstr, cb?: CallbackFunction) {
		const message: Message.From.Instance.Any = {...msg, ...{
			messageType: 'instance',
			cmdId: handle.cmdId++,
			instanceId: handle.id
		}}
		if (cb) handle.queue[message.cmdId + ''] = cb
		// Send message to Parent:
		this.mockProcessSend(message)
	}
}
