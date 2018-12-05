// import { cluster } from 'cluster'
import { fork, ChildProcess } from 'child_process'

import * as callsites from 'callsites'
import * as path from 'path'
import { InitProps, InitProp, InitPropType, MessageType, CallbackFunction, MessageInitConstr, MessageInit, MessageFcnConstr, MessageFcn, MessageSetConstr, MessageSet, MessageReplyConstr, MessageReply, MessageToChild, MessageFromChildCallback, MessageFromChild, MessageFromChildReply, MessageFromChildLog } from './lib'

// TODO: change this as Variadic types are implemented in TS
// https://github.com/Microsoft/TypeScript/issues/5453
export type ReturnType<T> = T extends (...args: any[]) => infer R ? R : any

export type Promisify<T> = {
	[K in keyof T]: T[K] extends Function ? (...args: any[]) => Promise<ReturnType<T[K]>> : Promise<T[K]>
}

export interface IProxy {
	_destroyChild: Function
}
export class ProxyClass {
	public _destroyChild: Function
}

export type ThreadedClass<T> = IProxy & Promisify<T>

let allChildren: Array<ChildProcess> = []

/**
 * Returns an asynchronous version of the provided class
 * @param orgModule Path to imported module (this is what is in the require('XX') function, or import {class} from 'XX'} )
 * @param orgClass The class to be threaded
 * @param constructorArgs An array of arguments to be fed into the class constructor
 */
export function threadedClass<T> (orgModule: string, orgClass: Function, constructorArgs: any[]): Promise<ThreadedClass<T>> {
	// @ts-ignore expression is allways false
	// if (typeof orgClass !== 'function') throw Error('argument 2 must be a class!')
	let orgClassName: string = orgClass.name
	let parentCallPath = callsites()[1].getFileName()
	let thisCallPath = callsites()[0].getFileName()

	let closed: boolean = false

	let callbackId = 0
	let callbacks: {[key: string]: Function} = {}

	const fixArgs = (...args: any[]) => {
		return args.map((arg) => {
			if (arg instanceof Buffer) return { type: 'Buffer', value: arg.toString('hex') }
			if (typeof arg === 'string') return { type: 'string', value: arg }
			if (typeof arg === 'number') return { type: 'number', value: arg }
			if (typeof arg === 'function') {
				callbackId++
				callbacks[callbackId + ''] = arg
				return { type: 'function', value: callbackId + '' }
			}
			return { type: 'other', value: arg }
		})
	}

	return new Promise((resolve, reject) => {

		if (!parentCallPath) throw new Error('Unable to resolve parent file path')
		if (!thisCallPath) throw new Error('Unable to resolve own file path')

		let absPathToModule = (
			orgModule.match(/^\./) ?
			path.resolve(parentCallPath, '../', orgModule) :
			orgModule
		)
		let verifiedPathToModule = require.resolve(absPathToModule)

		let pathToWorker = thisCallPath
			.replace(/index(\.[tj]s)$/,'worker.js')
			.replace(/src([\\\/])worker/,'dist$1worker')

		let _child: ChildProcess = fork(pathToWorker)
		allChildren.push(_child)
		let cmdId = 0
		let queue: {[cmdId: string]: CallbackFunction} = {}

		function sendInit (data: MessageInitConstr, cb?: CallbackFunction) {
			cmdId++

			let msg: MessageInit = {
				cmd: MessageType.INIT,
				cmdId: cmdId,
				modulePath: data.modulePath,
				className: data.className,
				args: data.args
			}
			if (cb) queue[msg.cmdId + ''] = cb
			sendMessage(msg)
		}
		function sendFcn (data: MessageFcnConstr, cb?: CallbackFunction) {
			cmdId++

			let msg: MessageFcn = {
				cmd: MessageType.FUNCTION,
				cmdId: cmdId,
				fcn: data.fcn,
				args: data.args
			}
			if (cb) queue[msg.cmdId + ''] = cb
			sendMessage(msg)
		}
		function sendSet (data: MessageSetConstr, cb?: CallbackFunction) {
			cmdId++

			let msg: MessageSet = {
				cmd: MessageType.SET,
				cmdId: cmdId,
				property: data.property,
				value: data.value
			}
			if (cb) queue[msg.cmdId + ''] = cb
			sendMessage(msg)
		}
		function sendReply (data: MessageReplyConstr, cb?: CallbackFunction) {
			cmdId++

			let msg: MessageReply = {
				cmd: MessageType.REPLY,
				cmdId: cmdId,
				replyTo: data.replyTo,
				reply: data.reply
			}
			if (cb) queue[msg.cmdId + ''] = cb
			sendMessage(msg)
		}
		function sendMessage (msg: MessageToChild) {
			_child.send(msg)
		}
		function reply (msg: MessageFromChildCallback, reply: any) {
			sendReply({
				replyTo: msg.cmdId,
				reply: reply
			})
		}
		function replyError (msg: MessageFromChildCallback, err: Error) {
			sendReply({
				replyTo: msg.cmdId,
				error: err
			})
		}
		_child.on('message', (m: MessageFromChild) => {
			if (m.cmd === 'reply') {
				let msg: MessageFromChildReply = m
				let cb = queue[msg.replyTo + '']
				if (!cb) throw Error('cmdId "' + msg.cmdId + '" not found!')
				if (msg.error) {
					cb(msg.error)
				} else {
					cb(null, msg.reply)
				}
				delete queue[msg.replyTo + '']
			} else if (m.cmd === 'log') {
				let msg: MessageFromChildLog = m
				console.log.apply(null, ['LOG'].concat(msg.log))
			} else if (m.cmd === 'callback') {
				let msg: MessageFromChildCallback = m
				let callback = callbacks[msg.callbackId]
				if (callback) {
					Promise.resolve(callback(...msg.args))
					.then((result: any) => {
						reply(msg, result)
					})
					.catch((err: Error) => {
						replyError(msg, err)
					})
				} else throw Error('callback "' + msg.callbackId + '" not found')
			}
		})
		_child.on('close', (code) => {
			code = code
			// console.log(`child process exited with code ${code}`)
			closed = true
		})
		sendInit({
			modulePath: verifiedPathToModule,
			className: orgClassName,
			args: constructorArgs
		}, (err: Error | null, props: InitProps) => {
			if (err) {
				reject(err)
			} else {
				let proxy = new ProxyClass() as ThreadedClass<T>
				proxy._destroyChild = () => {
					_child.kill()
				}
				props.forEach((p: InitProp) => {
					if (closed) throw Error('Child process has been closed')

					if (proxy.hasOwnProperty(p.key)) {
						// console.log('skipping property ' + p.key)
						return
					}
					if (p.type === InitPropType.FUNCTION) {
						// @ts-ignore proxy is a class
						const fcn = (...args: any[]) => {
							return new Promise((resolve, reject) => {
								// go through arguments and serialize them:
								let fixedArgs = fixArgs(...args)

								sendFcn({
									fcn: p.key,
									args: fixedArgs
								}, (err, res) => {
									if (err) reject(err)
									else resolve(res)
								})
							})
						}
						if (p.descriptor.inProto) {
							// @ts-ignore prototype is not in typings
							proxy.__proto__[p.key] = fcn
						} else {
							// @ts-ignore
							proxy[p.key] = fcn
						}
					} else if (p.type === InitPropType.VALUE) {

						let m: PropertyDescriptor = {
							configurable: 	false, // We do not support configurable properties
							enumerable: 	p.descriptor.enumerable
							// writable: // We handle everything through getters & setters instead
						}
						if (
							p.descriptor.get ||
							p.descriptor.readable
						) {
							m.get = function () {
								return new Promise((resolve, reject) => {
									sendFcn({
										fcn: p.key,
										args: []
									}, (err, res) => {
										if (err) reject(err)
										else resolve(res)
									})
								})
							}
						}
						if (
							p.descriptor.set ||
							p.descriptor.writable
						) {
							m.set = function (newVal) {
								let fixedArgs = fixArgs(newVal)

								// in the strictest of worlds, we sould block the main thread here,
								// until the remote acknowledges the write.
								// Instead we're going to pretend that everything is okay. *whistling*
								sendSet({
									property: p.key,
									value: fixedArgs[0]
								}, (err, _result) => {
									if (err) {
										console.log('Error in setter', err)
									}
								})

							}
						}
						Object.defineProperty(proxy, p.key, m)
					}
				})
				resolve(proxy)
			}
		})
	})
}
// Close the child processes upon exit:
process.stdin.resume() // so the program will not close instantly

function exitHandler (options: any, err: Error) {
	allChildren.forEach((child) => {
		child.kill()
	})
	// if (options.cleanup) console.log('cleanup')
	if (err) console.log(err.stack)
	if (options.exit) process.exit()
}

// do something when app is closing
process.on('exit', exitHandler.bind(null, { cleanup: true }))

// catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, { exit: true }))

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, { exit: true }))
process.on('SIGUSR2', exitHandler.bind(null, { exit: true }))

// catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, { exit: true }))
