import {
	MessageToChild,
	MessageFromChild,
	CallbackFunction,
	MessageFromChildConstr,
	InstanceHandle,
	Worker,
	MessageType
} from './internalApi'

class ThreadedWorker extends Worker {
	protected instanceHandles: {[instanceId: string]: InstanceHandle} = {}

	protected sendMessageToParent (handle: InstanceHandle, msg: MessageFromChildConstr, cb?: CallbackFunction) {
		if (process.send) {
			if (msg.cmd === MessageType.LOG) {
				const message: MessageFromChild = {...msg, ...{
					cmdId: 0,
					instanceId: ''
				}}
				process.send(message)
			} else {
				const message: MessageFromChild = {...msg, ...{
					cmdId: handle.cmdId++,
					instanceId: handle.id
				}}
				if (cb) handle.queue[message.cmdId + ''] = cb
				process.send(message)
			}
		} else throw Error('process.send undefined!')
	}
	protected killInstance (handle: InstanceHandle) {
		delete this.instanceHandles[handle.id]
	}

}
// const _orgConsoleLog = console.log

if (process.send) {
	const worker = new ThreadedWorker()
	console.log = worker.log
	process.on('message', (m: MessageToChild) => {
		// Received message from parent
		worker.onMessageFromParent(m)
	})
} else {
	throw Error('process.send undefined!')
}
