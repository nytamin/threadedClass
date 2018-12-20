import {
	MessageToChild,
	MessageFromChild,
	CallbackFunction,
	MessageFromChildConstr,
	InstanceHandle,
	Worker
} from './internalApi'

class ThreadedWorker extends Worker {
	protected instanceHandles: {[instanceId: string]: InstanceHandle} = {}
	protected _orgConsoleLog (...args: any[]) {
		_orgConsoleLog(...args)
	}

	protected processSend (handle: InstanceHandle, msg: MessageFromChildConstr, cb?: CallbackFunction) {
		if (process.send) {
			const message: MessageFromChild = {...msg, ...{
				cmdId: handle.cmdId++,
				instanceId: handle.id
			}}
			if (cb) handle.queue[message.cmdId + ''] = cb
			process.send(message)
		} else throw Error('process.send undefined!')
	}
	protected killInstance (handle: InstanceHandle) {
		delete this.instanceHandles[handle.id]
	}

}
const _orgConsoleLog = console.log

if (process.send) {
	const worker = new ThreadedWorker()
	console.log = worker.log
	process.on('message', (m: MessageToChild) => {
		worker.messageCallback(m)
	})
} else {
	throw Error('process.send undefined!')
}
