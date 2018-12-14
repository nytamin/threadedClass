import {
	InitPropType,
	InitProps,
	InitPropDescriptor,
	MessageType,
	MessageInit,
	MessageFcn,
	MessageToChild,
	MessageReply,
	MessageFromChild,
	MessageFromChildLogConstr,
	MessageFromChildReplyConstr,
	MessageFromChildCallbackConstr,
	CallbackFunction,
	MessageSet,
	MessageFromChildConstr,
	ArgDefinition,
	MessageKill
} from './internalApi'

interface InstanceHandle {
	id: string
	cmdId: number
	queue: {[cmdId: string]: CallbackFunction}

	instance: any
}

const instanceHandles: {[instanceId: string]: InstanceHandle} = {}
// Override console.log:
const _orgConsoleLog = console.log
console.log = log

// _orgConsoleLog('Child process starting')

function killInstance (handle: InstanceHandle) {
	delete instanceHandles[handle.id]
}

if (process.send) {
	process.on('message', (m: MessageToChild) => {
		let handle = instanceHandles[m.instanceId]
		if (!handle && m.cmd !== MessageType.INIT) {
			_orgConsoleLog(`Child process: Unknown instanceId: "${m.instanceId}"`)
			return // fail silently?
		}
		if (!handle) {
			// create temporary handle:
			handle = {
				id: m.instanceId,
				cmdId: 0,
				queue: {},
				instance: {}
			}
		}
		try {
			const instance = handle.instance

			if (m.cmd === MessageType.INIT) {
				const msg: MessageInit = m
				const module = require(msg.modulePath)

				const handle: InstanceHandle = {
					id: msg.instanceId,
					cmdId: 0,
					queue: {},
					instance: ((...args: Array<any>) => {
						return new module[msg.className](...args)
					}).apply(null, msg.args)
				}
				instanceHandles[handle.id] = handle

				const instance = handle.instance

				const allProps = getAllProperties(instance)
				const props: InitProps = []
				allProps.forEach((prop: string) => {
					if ([
						'constructor',
						'__defineGetter__',
						'__defineSetter__',
						'hasOwnProperty',
						'__lookupGetter__',
						'__lookupSetter__',
						'isPrototypeOf',
						'propertyIsEnumerable',
						'toString',
						'valueOf',
						'__proto__',
						'toLocaleString'
					].indexOf(prop) !== -1) return
					// console.log(prop, typeof instance[prop])

					let descriptor = Object.getOwnPropertyDescriptor(instance, prop)
					let inProto: number = 0
					let proto = instance.__proto__
					while (!descriptor) {
						if (!proto) break
						descriptor = Object.getOwnPropertyDescriptor(proto, prop)
						inProto++
						proto = proto.__proto__
					}

					if (!descriptor) descriptor = {}

					let descr: InitPropDescriptor = {
						// configurable:	!!descriptor.configurable,
						inProto: 		inProto,
						enumerable:		!!descriptor.enumerable,
						writable:		!!descriptor.writable,
						get:			!!descriptor.get,
						set:			!!descriptor.set,
						readable:		!!(!descriptor.get && !descriptor.get) // if no getter or setter, ie an ordinary property
					}

					if (typeof instance[prop] === 'function') {
						props.push({
							key: prop,
							type: InitPropType.FUNCTION,
							descriptor: descr
						})
					} else {
						props.push({
							key: prop,
							type: InitPropType.VALUE,
							descriptor: descr
						})
					}
				})
				reply(handle, msg, props)
			} else if (m.cmd === MessageType.REPLY) {
				const msg: MessageReply = m
				let cb = handle.queue[msg.replyTo + '']
				if (!cb) throw Error('cmdId "' + msg.cmdId + '" not found!')
				if (msg.error) {
					cb(msg.error)
				} else {
					cb(null, msg.reply)
				}
				delete handle.queue[msg.replyTo + '']
			} else if (m.cmd === MessageType.FUNCTION) {
				let msg: MessageFcn = m
				if (instance[msg.fcn]) {

					const fixedArgs = fixArgs(handle, msg.args)

					let p = (
						typeof instance[msg.fcn] === 'function' ?
						instance[msg.fcn](...fixedArgs) :
						instance[msg.fcn]
					)
					if (typeof instance[msg.fcn] !== 'function' && fixedArgs.length === 1) {
						instance[msg.fcn] = fixedArgs[0]
					}
					Promise.resolve(p)
					.then((result) => {
						reply(handle, msg, result)
					})
					.catch((err) => {
						replyError(handle, msg, err)
					})
				} else {
					replyError(handle, msg, 'Function "' + msg.fcn + '" not found')
				}
			} else if (m.cmd === MessageType.SET) {
				let msg: MessageSet = m

				// _orgConsoleLog('msg')
				const fixedValue = fixArgs(handle, [msg.value])[0]
				instance[msg.property] = fixedValue

				reply(handle, msg, fixedValue)
			} else if (m.cmd === MessageType.KILL) {
				let msg: MessageKill = m
				// kill off instance
				killInstance(handle)

				reply(handle, msg, null)
			}
		} catch (e) {
			// _orgConsoleLog('error', e)

			if (m.cmdId) replyError(handle, m, 'Error: ' + e.toString() + e.stack)
			else log(handle, 'Error: ' + e.toString(), e.stack)
		}
	})
} else {
	throw Error('process.send undefined!')
}
function fixArgs (handle: InstanceHandle, args: Array<ArgDefinition>) {
	// Go through arguments and de-serialize them
	return args.map((a) => {
		if (a.type === 'string') return a.value
		if (a.type === 'number') return a.value
		if (a.type === 'Buffer') return Buffer.from(a.value, 'hex')
		if (a.type === 'function') {
			return ((...args: any[]) => {
				return new Promise((resolve, reject) => {
					sendCallback(
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
function reply (handle: InstanceHandle, m: MessageToChild, reply: any) {
	sendReply(handle, m.cmdId, undefined, reply)
}
function replyError (handle: InstanceHandle, m: MessageToChild, error: any) {
	sendReply(handle, m.cmdId, error)
}
function sendReply (handle: InstanceHandle, replyTo: number, error?: Error, reply?: any) {
	let msg: MessageFromChildReplyConstr = {
		cmd: MessageType.REPLY,
		replyTo: replyTo,
		error: error,
		reply: reply
	}
	processSend(handle, msg)
}
function log (handle: InstanceHandle, ...data: any[]) {
	sendLog(handle, data)
}
function sendLog (handle: InstanceHandle, log: any[]) {
	let msg: MessageFromChildLogConstr = {
		cmd: MessageType.LOG,
		log: log
	}
	processSend(handle, msg)
}
function sendCallback (handle: InstanceHandle, callbackId: string, args: any[], cb: CallbackFunction) {
	let msg: MessageFromChildCallbackConstr = {
		cmd: MessageType.CALLBACK,
		callbackId: callbackId,
		args: args
	}
	processSend(handle, msg, cb)
}
function processSend (handle: InstanceHandle, msg: MessageFromChildConstr, cb?: CallbackFunction) {
	if (process.send) {
		const message: MessageFromChild = {...msg, ...{
			cmdId: handle.cmdId++,
			instanceId: handle.id
		}}
		if (cb) handle.queue[message.cmdId + ''] = cb
		process.send(message)
	} else throw Error('process.send undefined!')
}
function getAllProperties (obj: Object) {
	let props: Array<string> = []

	do {
		props = props.concat(Object.getOwnPropertyNames(obj))
		obj = Object.getPrototypeOf(obj)
	} while (obj)
	return props
}
