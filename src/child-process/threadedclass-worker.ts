import {
	CallbackFunction,
	EncodingStrategy,
	Message
} from '../shared/sharedApi'
import {
	isBrowser,
	nodeSupportsWorkerThreads,
	getWorkerThreads
} from '../shared/lib'
import { ChildHandle, InstanceHandle, Worker } from './worker'

const WorkerThreads = getWorkerThreads()

// This file is launched in the worker child process.
// This means that all code in this file is considered to be sandboxed in the child process.

function send (message: Message.From.Any) {
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
	constructor () {
		super()
		// Detect transport: worker_threads and web-workers use structured clone;
		// child_process fork uses JSON (the default).
		const isWorkerThread = WorkerThreads
			? !WorkerThreads.isMainThread
			: false
		if (isBrowser() || isWorkerThread) {
			this.encodingStrategy = EncodingStrategy.StructuredClone
		}
	}

	protected sendInstanceMessageToParent (
		handle: InstanceHandle,
		msg: Message.From.Instance.AnyConstr,
		cb?: CallbackFunction
	) {
		const message: Message.From.Instance.Any = {
			...msg,
			...{
				messageType: 'instance',
				cmdId: handle.cmdId++,
				instanceId: handle.id
			}
		}
		if (cb) {
			handle.queue[message.cmdId + ''] = {
				// Store an error, just so we can append the original stack later in case there's an error:
				traceError: new Error('Error when calling callback'),
				cb
			}
		}
		send(message)
	}
	protected sendChildMessageToParent (
		handle: ChildHandle,
		msg: Message.From.Child.AnyConstr,
		cb?: CallbackFunction
	) {
		const message: Message.From.Child.Any = {
			...msg,
			...{
				messageType: 'child',
				cmdId: handle.cmdId++
			}
		}
		if (cb) {
			handle.queue[message.cmdId + ''] = {
				// Store an error, just so we can append the original stack later in case there's an error:
				traceError: new Error('Error when calling callback'),
				cb
			}
		}
		send(message)
	}
	protected killInstance (handle: InstanceHandle) {
		delete this.instanceHandles[handle.id]
	}
}

function isRunningInAWorkerThread (): boolean {
	if (nodeSupportsWorkerThreads()) {
		const workerThreads = getWorkerThreads()
		if (workerThreads) {
			if (!workerThreads.isMainThread) {
				return true
			}
		}
	}
	return false
}

if (isBrowser()) {
	// Is running in a web-worker

	const worker = new ThreadedWorker()

	// @ts-ignore global onmessage
	onmessage = (m: any) => {
		// Received message from parent
		if (m.type === 'message') {
			worker.onMessageFromParent(m.data)
		} else {
			console.log('child process: onMessage', m)
		}
	}
} else if (isRunningInAWorkerThread()) {
	// Is running in a worker-thread

	if (WorkerThreads) {
		const worker = new ThreadedWorker()
		console.log = worker.log
		console.error = worker.logError

		if (WorkerThreads.parentPort) {
			WorkerThreads.parentPort.on('message', (m: Message.To.Any) => {
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
	// Is running in a child process

	const worker = new ThreadedWorker()
	console.log = worker.log
	console.error = worker.logError
	process.on('message', (m: Message.To.Any) => {
		// Received message from parent
		worker.onMessageFromParent(m)
	})
} else {
	throw Error('process.send and onmessage are undefined!')
}
