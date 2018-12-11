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
	MessageFromChildLog,
	MessageFromChildReplyConstr,
	MessageFromChildReply,
	MessageFromChildCallbackConstr,
	MessageFromChildCallback,
	CallbackFunction,
	MessageSet
} from './lib'

let instance: any
// Override console.log:
// let orgConsoleLog = console.log
console.log = log

let cmdId = 0
let queue: {[cmdId: string]: Function} = {}

if (process.send) {
	process.on('message', (m: MessageToChild) => {
		try {
			if (m.cmd === MessageType.REPLY) {
				let msg: MessageReply = m
				let cb = queue[msg.replyTo + '']
				if (!cb) throw Error('cmdId "' + msg.cmdId + '" not found!')
				if (msg.error) {
					cb(msg.error)
				} else {
					cb(null, msg.reply)
				}
				delete queue[msg.replyTo + '']
			} else if (m.cmd === 'init') {
				let msg: MessageInit = m
				let module = require(msg.modulePath)
				instance = ((...args: Array<any>) => {
					return new module[msg.className](...args)
				}).apply(null, msg.args)

				let allProps = getAllProperties(instance)
				let props: InitProps = []
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
				reply(msg, props)
			} else if (m.cmd === MessageType.FUNCTION) {
				let msg: MessageFcn = m
				if (instance[msg.fcn]) {

					const fixedArgs = fixArgs(msg.args)

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
						reply(msg, result)
					})
					.catch((err) => {
						replyError(msg, err)
					})
				} else {
					replyError(msg, 'Function "' + msg.fcn + '" not found')
				}
			} else if (m.cmd === MessageType.SET) {
				let msg: MessageSet = m

				const fixedValue = fixArgs([msg.value])[0]
				instance[msg.property] = fixedValue

				reply(msg, fixedValue)
			}
		} catch (e) {
			if (m.cmdId) replyError(m, 'Error: ' + e.toString() + e.stack)
			else log('Error: ' + e.toString(), e.stack)
		}
	})
} else {
	throw Error('process.send undefined!')
}
function fixArgs (args: Array<any>) {
	// Go through arguments and de-serialize them
	return args.map((a) => {
		if (a.type === 'string') return a.value
		if (a.type === 'number') return a.value
		if (a.type === 'Buffer') return Buffer.from(a.value, 'hex')
		if (a.type === 'function') {
			return ((...args: any[]) => {
				return new Promise((resolve, reject) => {
					sendCallback({
						callbackId: a.value,
						args: args
					}, (err, result) => {
						if (err) reject(err)
						else resolve(result)
					})

				})
			})
		}
		return a.value
	})
}
function reply (m: MessageToChild, reply: any) {
	sendReply({
		replyTo: m.cmdId,
		reply: reply
	})
}
function replyError (m: MessageToChild, err: any) {
	sendReply({
		replyTo: m.cmdId,
		error: err
	})
}
function sendReply (m: MessageFromChildReplyConstr) {
	cmdId++
	let msg: MessageFromChildReply = {
		cmd: MessageType.REPLY,
		cmdId: cmdId,
		replyTo: m.replyTo,
		error: m.error,
		reply: m.reply
	}
	processSend(msg)
}
function log (...data: any[]) {
	sendLog({
		log: data
	})
}
function sendLog (m: MessageFromChildLogConstr) {
	cmdId++
	let msg: MessageFromChildLog = {
		cmd: MessageType.LOG,
		cmdId: cmdId,
		log: m.log
	}
	processSend(msg)
}
function sendCallback (m: MessageFromChildCallbackConstr, cb: CallbackFunction) {
	cmdId++
	let msg: MessageFromChildCallback = {
		cmd: 'callback',
		cmdId: cmdId,
		callbackId: m.callbackId,
		args: m.args
	}
	if (cb) queue[cmdId + ''] = cb
	processSend(msg)
}
function processSend (msg: MessageFromChild) {
	if (process.send) {
		process.send(msg)
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
