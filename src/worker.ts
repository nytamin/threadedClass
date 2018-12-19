import {
	MessageType,
	MessageToChild,
	MessageFromChild,
	MessageFromChildLogConstr,
	MessageFromChildReplyConstr,
	MessageFromChildCallbackConstr,
	CallbackFunction,
	MessageFromChildConstr,
	ArgDefinition,
	InstanceHandle,
	Worker
} from './internalApi'

class ThreadedWorker extends Worker {
	protected instanceHandles: {[instanceId: string]: InstanceHandle} = {}
	protected _orgConsoleLog (...args: any[]) {
		_orgConsoleLog(...args)
	}
	protected fixArgs (handle: InstanceHandle, args: Array<ArgDefinition>) {
		// Go through arguments and de-serialize them
		return args.map((a) => {
			if (a.type === 'string') return a.value
			if (a.type === 'number') return a.value
			if (a.type === 'Buffer') return Buffer.from(a.value, 'hex')
			if (a.type === 'function') {
				return ((...args: any[]) => {
					return new Promise((resolve, reject) => {
						this.sendCallback(
							handle,
							a.value,
							args,
							(err, result) => {
								if (err) reject(err)
								else resolve(result)
							}
						)
					})
				})
			}
			return a.value
		})
	}
	protected reply (handle: InstanceHandle, m: MessageToChild, reply: any) {
		this.sendReply(handle, m.cmdId, undefined, reply)
	}
	protected replyError (handle: InstanceHandle, m: MessageToChild, error: any) {
		this.sendReply(handle, m.cmdId, error)
	}
	protected sendReply (handle: InstanceHandle, replyTo: number, error?: Error, reply?: any) {
		let msg: MessageFromChildReplyConstr = {
			cmd: MessageType.REPLY,
			replyTo: replyTo,
			error: error,
			reply: reply
		}
		this.processSend(handle, msg)
	}
	log (handle: InstanceHandle, ...data: any[]) {
		this.sendLog(handle, data)
	}
	protected sendLog (handle: InstanceHandle, log: any[]) {
		let msg: MessageFromChildLogConstr = {
			cmd: MessageType.LOG,
			log: log
		}
		this.processSend(handle, msg)
	}
	protected sendCallback (handle: InstanceHandle, callbackId: string, args: any[], cb: CallbackFunction) {
		let msg: MessageFromChildCallbackConstr = {
			cmd: MessageType.CALLBACK,
			callbackId: callbackId,
			args: args
		}
		this.processSend(handle, msg, cb)
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
	protected getAllProperties (obj: Object) {
		let props: Array<string> = []

		do {
			props = props.concat(Object.getOwnPropertyNames(obj))
			obj = Object.getPrototypeOf(obj)
		} while (obj)
		return props
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
