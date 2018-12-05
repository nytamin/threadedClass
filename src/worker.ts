import {
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
	CallbackFunction
} from './index'

let instance: any
// Override console.log:
// let orgConsoleLog = console.log
console.log = log

let cmdId = 0
let queue: {[cmdId: string]: Function} = {}

if (process.send) {
	process.on('message', (m: MessageToChild) => {
		try {
			if (m.cmd === 'reply') {
				let msg = m as MessageReply
				let cb = queue[msg.replyTo + '']
				if (!cb) throw Error('cmdId "' + msg.cmdId + '" not found!')
				if (msg.error) {
					cb(msg.error)
				} else {
					cb(null, msg.reply)
				}
				delete queue[msg.replyTo + '']
			} else if (m.cmd === 'init') {
				let msg = m as MessageInit
				let module = require(msg.modulePath)
				instance = ((...args: Array<any>) => {
					return new module[msg.className](...args)
				}).apply(null, msg.args)

				let allProps = getAllProperties(instance)
				let props: InitProps = []
				allProps.forEach((prop: string) => {
					if ([
						'constructor',
						'windows',
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
					// if (prop === 'on') {
						// eventEmitter
					// }
					if (typeof instance[prop] === 'function') {
						props.push({
							key: prop,
							type: 'function'
						})
					} else {
						props.push({
							key: prop,
							type: 'value'
						})
					}
				})
				reply(msg, props)
			} else if (m.cmd === 'fcn') {
				let msg = m as MessageFcn
				if (instance[msg.fcn]) {

					// Go through arguments and de-serialize them
					let fixedArgs = msg.args.map((a) => {
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
			}
		} catch (e) {
			if (m.cmdId) replyError(m, 'Error: ' + e.toString() + e.stack)
			else log('Error: ' + e.toString(), e.stack)
		}
	})
} else {
	throw Error('process.send undefined!')
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
		cmd: 'reply',
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
		cmd: 'log',
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
export type InitProps = Array<InitProp>
export interface InitProp {
	key: string,
	type: 'function' | 'value'
}
