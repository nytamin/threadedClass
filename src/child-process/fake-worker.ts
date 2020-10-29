import {
	MessageFromChild,
	InstanceHandle,
	MessageFromChildConstr,
	CallbackFunction,
	MessageType
} from '../shared/sharedApi'
import { Worker } from './worker'

export class FakeWorker extends Worker {
	private mockProcessSend: (m: MessageFromChild) => void

	constructor (cb: (m: MessageFromChild) => void) {
		super()
		this.disabledMultithreading = true
		this.mockProcessSend = cb
	}

	protected killInstance () {
		// throw new Error('Trying to kill a non threaded process!')
	}

	protected sendMessageToParent (handle: InstanceHandle, msg: MessageFromChildConstr, cb?: CallbackFunction) {
		if (msg.cmd === MessageType.LOG) {
			const message: MessageFromChild = {...msg, ...{
				cmdId: 0,
				instanceId: ''
			}}
			// Send message to Parent:
			this.mockProcessSend(message)
		} else {
			const message: MessageFromChild = {...msg, ...{
				cmdId: handle.cmdId++,
				instanceId: handle.id
			}}
			if (cb) handle.queue[message.cmdId + ''] = cb
			// Send message to Parent:
			this.mockProcessSend(message)
		}
	}

}
