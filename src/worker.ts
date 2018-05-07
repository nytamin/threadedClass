
let instance: Object
// Override console.log:
let orgConsoleLog = console.log
console.log = log

if (process.send) {
	process.on('message', (m) => {
		try {
			if (m.replyTo) {
				let cb = queue[m.replyTo + '']
				if (!cb) throw Error('cmdId "' + m.cmdId + '" not found!')
				if (m.error) {
					cb(m.error)
				} else {
					cb(null, m.reply)
				}
				delete queue[m.replyTo + '']
			} else if (m.cmd === 'init') {
				let module = require(m.modulePath)
				instance = ((...args) => {
					return new module[m.className](...args)
				}).apply(null, m.args)

				let allProps = getAllProperties(instance)
				let props: Array<any> = []
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
				reply(m, props)
			} else if (m.cmd === 'fcn') {
				if (instance[m.fcn]) {

					// Go through arguments and de-serialize them
					let fixedArgs = m.args.map((a) => {
						if (a.type === 'string') return a.value
						if (a.type === 'number') return a.value
						if (a.type === 'Buffer') return Buffer.from(a.value, 'hex')
						if (a.type === 'function') {
							return ((...args: any[]) => {
								return new Promise((resolve, reject) => {
									send({
										cmd: 'callback',
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
						typeof instance[m.fcn] === 'function' ?
						instance[m.fcn](...fixedArgs) :
						instance[m.fcn]
					)
					Promise.resolve(p)
					.then((result) => {
						reply(m, result)
					})
					.catch((err) => {
						replyError(m, err)
					})
				} else {
					replyError(m, 'Function "' + m.fcn + '" not found')
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
function reply (m, reply: any) {
	let o = {
		replyTo: m.cmdId,
		reply: reply
	}
	send(o)
}
function replyError (m, err: any) {
	let o = {
		replyTo: m.cmdId,
		error: err
	}
	send(o)
}
function log (...str: any[]) {
	if (process.send) {
		process.send({
			cmd: 'log',
			log: str
		})
	} else throw Error('process.send undefined!')
}
let cmdId = 0
let queue: {[cmdId: string]: Function} = {}
function send (o: any, cb?: Function) {
	if (process.send) {
		cmdId++
		o.cmdId = cmdId
		if (cb) queue[cmdId + ''] = cb
		process.send(o)
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
