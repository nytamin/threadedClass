import {
	MessageToChild,
	MessageFromChild,
	CallbackFunction,
	MessageFromChildConstr,
	InstanceHandle,
	Worker,
	MessageType
} from './internalApi'
import { isBrowser, nodeSupportsWorkerThreads, getWorkerThreads } from './lib'

const WorkerThreads = getWorkerThreads()

/* This file is the one that is launched in the worker child process */

function send (message: any) {

	if (WorkerThreads) {
		if (WorkerThreads.parentPort) {
			WorkerThreads.parentPort.postMessage(message)
		} else {
			throw Error('WorkerThreads.parentPort not set!')
		}
	} else if (process.send) {
		process.send(message)

		// @ts-ignore global postMessage
	} else if (postMessage) {
		// @ts-ignore
		postMessage(message)
	} else throw Error('process.send and postMessage are undefined!')
}

class ThreadedWorker extends Worker {
	protected instanceHandles: {[instanceId: string]: InstanceHandle} = {}

	protected sendMessageToParent (handle: InstanceHandle, msg: MessageFromChildConstr, cb?: CallbackFunction) {
		if (msg.cmd === MessageType.LOG) {
			const message: MessageFromChild = {...msg, ...{
				cmdId: 0,
				instanceId: ''
			}}
			send(message)
		} else {
			const message: MessageFromChild = {...msg, ...{
				cmdId: handle.cmdId++,
				instanceId: handle.id
			}}
			if (cb) handle.queue[message.cmdId + ''] = cb
			send(message)
		}
	}
	protected killInstance (handle: InstanceHandle) {
		delete this.instanceHandles[handle.id]
	}

}
// const _orgConsoleLog = console.log

if (isBrowser()) {
	const worker = new ThreadedWorker()
	// console.log = worker.log
	// @ts-ignore global onmessage
	onmessage = (m: any) => {
		// Received message from parent
		if (m.type === 'message') {
			worker.onMessageFromParent(m.data)
		} else {
			console.log('child process: onMessage', m)
		}
	}
} else if (nodeSupportsWorkerThreads()) {

	if (WorkerThreads) {
		const worker = new ThreadedWorker()
		console.log = worker.log
		console.error = worker.logError

		if (WorkerThreads.parentPort) {
			WorkerThreads.parentPort.on('message', (m: MessageToChild) => {
				// Received message from parent
				worker.onMessageFromParent(m)
			})
		} else {
			throw Error('WorkerThreads.parentPort not set!')
		}
	} else {
		throw Error('WorkerThreads not available!')
	}
} else if (process.send) {
	const worker = new ThreadedWorker()
	console.log = worker.log
	console.error = worker.logError
	process.on('message', (m: MessageToChild) => {
		// Received message from parent
		worker.onMessageFromParent(m)
	})
} else {
	throw Error('process.send and onmessage are undefined!')
}
