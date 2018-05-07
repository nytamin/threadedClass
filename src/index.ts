// import { cluster } from 'cluster'
import { fork, ChildProcess } from 'child_process'

import * as callsites from 'callsites'
import * as path from 'path'

// TODO: change this as Variadic types are implemented in TS
// https://github.com/Microsoft/TypeScript/issues/5453
export type ReturnType<T> = T extends (...args: any[]) => infer R ? R : any

export type Promisify<T> = {
	[K in keyof T]: (...args: any[]) => Promise<ReturnType<T[K]>>
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
export function threadedClass<T> (orgModule, orgClass: Function, constructorArgs: any[] ): Promise<ThreadedClass<T>> {
	// @ts-ignore expression is allways false
	// if (typeof orgClass !== 'function') throw Error('argument 2 must be a class!')
	let orgClassName: string = orgClass.name
	let parentCallPath = callsites()[1].getFileName()
	let thisCallPath = callsites()[0].getFileName()

	let closed: boolean = false

	let callbackId = 0
	let callbacks: {[key: string]: Function} = {}

	return new Promise((resolve, reject) => {

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
		let queue: {[cmdId: string]: Function} = {}
		function send (data, cb?: Function) {
			cmdId++
			data.cmdId = cmdId
			if (cb) queue[cmdId + ''] = cb
			_child.send(data)
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
		_child.on('message', (msg) => {
			if (msg.replyTo) {
				let cb = queue[msg.replyTo + '']
				if (!cb) throw Error('cmdId "' + msg.cmdId + '" not found!')
				if (msg.error) {
					cb(msg.error)
				} else {
					cb(null, msg.reply)
				}
				delete queue[msg.replyTo + '']
			} else if (msg.cmd === 'log') {
				console.log.apply(null, ['LOG'].concat(msg.log))
			} else if (msg.cmd === 'callback') {
				let callback = callbacks[msg.callbackId]
				if (callback) {
					Promise.resolve(callback(...msg.args))
					.then((result) => {
						reply(msg, result)
					})
					.catch((err) => {
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
		send({
			cmd: 'init',
			modulePath: verifiedPathToModule,
			className: orgClassName,
			args: constructorArgs
		}, (err, props) => {
			if (err) {
				reject(err)
			} else {
				let proxy = new ProxyClass() as ThreadedClass<T>
				proxy._destroyChild = () => {
					_child.kill()
				}
				props.forEach((p) => {
					if (closed) throw Error('Child process has been closed')
					proxy[p.key] = (...args: any[]) => {
						return new Promise((resolve, reject) => {
							// go through arguments and serialize them:
							let fixedArgs = args.map((arg) => {
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

							send({
								cmd: 'fcn',
								fcn: p.key,
								args: fixedArgs
							}, (err, res) => {
								if (err) reject(err)
								else resolve(res)
							})
						})
					}
				})
				resolve(proxy)
			}
		})
	})
}
// Close the child processes upon exit:
process.stdin.resume() // so the program will not close instantly

function exitHandler (options, err) {
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
