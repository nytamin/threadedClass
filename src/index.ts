// import { cluster } from 'cluster'
import { fork, ChildProcess } from 'child_process'

import * as callsites from 'callsites'
import * as path from 'path'
import { InitProps, InitProp } from './worker'

// TODO: change this as Variadic types are implemented in TS
// https://github.com/Microsoft/TypeScript/issues/5453
export type ReturnType<T> = T extends (...args: any[]) => infer R ? R : any

export type Promisify<T> = {
	[K in keyof T]: T[K] extends Function ? (...args: any[]) => Promise<ReturnType<T[K]>> : T[K]
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
export function threadedClass<T> (orgModule: string, orgClass: Function, constructorArgs: any[] ): Promise<ThreadedClass<T>> {
	// @ts-ignore expression is allways false
	// if (typeof orgClass !== 'function') throw Error('argument 2 must be a class!')
	let orgClassName: string = orgClass.name
	let parentCallPath = callsites()[1].getFileName()
	let thisCallPath = callsites()[0].getFileName()

	let closed: boolean = false

	let callbackId = 0
	let callbacks: {[key: string]: Function} = {}

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
				cmd: 'init',
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
				cmd: 'fcn',
				cmdId: cmdId,
				fcn: data.fcn,
				args: data.args
			}
			if (cb) queue[msg.cmdId + ''] = cb
			sendMessage(msg)
		}
		function sendReply (data: MessageReplyConstr, cb?: CallbackFunction) {
			cmdId++

			let msg: MessageReply = {
				cmd: 'reply',
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
			// if (m.replyTo) {
			if (m.cmd === 'reply') {
				let msg = m as MessageFromChildReply
				let cb = queue[msg.replyTo + '']
				if (!cb) throw Error('cmdId "' + msg.cmdId + '" not found!')
				if (msg.error) {
					cb(msg.error)
				} else {
					cb(null, msg.reply)
				}
				delete queue[msg.replyTo + '']
			} else if (m.cmd === 'log') {
				let msg = m as MessageFromChildLog
				console.log.apply(null, ['LOG'].concat(msg.log))
			} else if (m.cmd === 'callback') {
				let msg = m as MessageFromChildCallback
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
					const fixArgs = (...args: any[]) => {
						return args.map((arg) => {
							if (arg instanceof Buffer) return {type: 'Buffer', value: arg.toString('hex')}
							if (typeof arg === 'string') return {type: 'string', value: arg}
							if (typeof arg === 'number') return {type: 'number', value: arg}
							if (typeof arg === 'function') {
								callbackId++
								callbacks[callbackId + ''] = arg
								return {type: 'function', value: callbackId + ''}
							}
							return {type: 'other', value: arg}
						})
					}

					// console.log(p)
					if (p.type === 'value') {
						Object.defineProperty(proxy, p.key, {
							get: function () {
								return new Promise((resolve, reject) => {
									sendFcn({
										fcn: p.key,
										args: []
									}, (err, res) => {
										if (err) reject(err)
										else resolve(res)
									})
								})
							},
							set: function (newVal) {
								let fixedArgs = fixArgs(newVal)

								return new Promise((resolve, reject) => {
									sendFcn({
										fcn: p.key,
										args: fixedArgs
									}, (err, res) => {
										if (err) reject(err)
										else resolve(res)
									})
								})
							},
							configurable: true
						})
					} else {
						// @ts-ignore proxy is a class
						proxy[p.key] = (...args: any[]) => {
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
	if (options.cleanup) console.log('clean')
	if (err) console.log(err.stack)
	if (options.exit) process.exit()
}

// do something when app is closing
process.on('exit', exitHandler.bind(null,{cleanup: true}))

// catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit: true}))

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, {exit: true}))
process.on('SIGUSR2', exitHandler.bind(null, {exit: true}))

// catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit: true}))
export interface MessageInitConstr {
	modulePath: string,
	className: string,
	args: Array<any>,
}
export interface MessageInit extends MessageInitConstr {
	cmd: 'init',
	cmdId: number
}
export interface MessageFcnConstr {
	fcn: string,
	args: Array<any>
}
export interface MessageFcn extends MessageFcnConstr {
	cmd: 'fcn',
	cmdId: number
}
export interface MessageReplyConstr {
	replyTo: number,
	reply?: any,
	error?: Error
}
export interface MessageReply extends MessageReplyConstr {
	cmd: 'reply',
	cmdId: number,
}
export type MessageToChild = MessageInit | MessageFcn | MessageReply
export interface MessageFromChildReplyConstr {
	replyTo: number,
	error?: Error,
	reply?: any,
}
export interface MessageFromChildReply extends MessageFromChildReplyConstr {
	cmd: 'reply'
	cmdId: number,
}
export interface MessageFromChildLogConstr {
	log: Array<any>,
}
export interface MessageFromChildLog extends MessageFromChildLogConstr {
	cmd: 'log'
	cmdId: number,
}
export interface MessageFromChildCallbackConstr {
	callbackId: string,
	args: Array<any>
}
export interface MessageFromChildCallback extends MessageFromChildCallbackConstr {
	cmd: 'callback',
	cmdId: number,
}
export type MessageFromChild = MessageFromChildReply | MessageFromChildLog | MessageFromChildCallback
export type CallbackFunction = (e: Error | null, res?: any) => void
// export interface MessageFcn {
// 	cmd: 'fcn',
// 	modulePath: string,
// 	className: string,
// 	args: Array<any>

// 	replyTo?: number,
// 	cmdId?: number,
// 	reply?: any,
// 	error?: Error
// }
