import * as path from 'path'
import * as callsites from 'callsites'
import {
	InitProps,
	InitProp,
	InitPropType,
	MessageType,
	InstanceCallbackFunction,
	MessageInitConstr,
	MessageFcnConstr,
	MessageSetConstr,
	MessageReplyConstr,
	MessageFromChildCallback,
	MessageFromChild,
	MessageFromChildReply,
	MessageFromChildLog,
	ArgDefinition
} from './internalApi'
import {
	ThreadedClass,
	ThreadedClassConfig
} from './api'
import { ThreadedClassManagerInternal, ChildInstance, Child } from './manager'

/**
 * Returns an asynchronous version of the provided class
 * @param orgModule Path to imported module (this is what is in the require('XX') function, or import {class} from 'XX'} )
 * @param orgClass The class to be threaded
 * @param constructorArgs An array of arguments to be fed into the class constructor
 */
export function threadedClass<T> (
	orgModule: string,
	orgClass: Function,
	constructorArgs: any[],
	config: ThreadedClassConfig = {}
): Promise<ThreadedClass<T>> {
	// @ts-ignore expression is allways false
	// if (typeof orgClass !== 'function') throw Error('argument 2 must be a class!')
	let orgClassName: string = orgClass.name
	let parentCallPath = callsites()[1].getFileName()
	let thisCallPath = callsites()[0].getFileName()

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
				.replace(/threadedClass(\.[tj]s)$/,'worker.js')
				.replace(/src([\\\/])worker/,'dist$1worker')

		const child: Child = ThreadedClassManagerInternal.getChild(config, pathToWorker)

		const proxy = {} as ThreadedClass<T>

		// @ts-ignore
		proxy.__proto__ = {}

		let instanceInChild: ChildInstance = ThreadedClassManagerInternal.attachInstance(config, child, proxy, onMessage)

		function sendInit (instance: ChildInstance, config: ThreadedClassConfig, cb?: InstanceCallbackFunction) {

			let msg: MessageInitConstr = {
				cmd: MessageType.INIT,
				modulePath: verifiedPathToModule,
				className: orgClassName,
				args: constructorArgs,
				config: config
			}
			ThreadedClassManagerInternal.sendMessage(instance, msg, cb)
		}
		function sendFcn (instance: ChildInstance, fcn: string, args: any[], cb?: InstanceCallbackFunction) {
			let msg: MessageFcnConstr = {
				cmd: MessageType.FUNCTION,
				fcn: fcn,
				args: args
			}
			ThreadedClassManagerInternal.sendMessage(instance, msg, cb)
		}
		function sendSet (instance: ChildInstance, property: string, value: ArgDefinition, cb?: InstanceCallbackFunction) {
			let msg: MessageSetConstr = {
				cmd: MessageType.SET,
				property: property,
				value: value
			}
			ThreadedClassManagerInternal.sendMessage(instance, msg, cb)
		}
		function sendReply (instance: ChildInstance, replyTo: number, error?: Error, reply?: any, cb?: InstanceCallbackFunction) {
			let msg: MessageReplyConstr = {
				cmd: MessageType.REPLY,
				replyTo: replyTo,
				reply: reply,
				error: error
			}
			ThreadedClassManagerInternal.sendMessage(instance, msg, cb)
		}
		function replyError (instance: ChildInstance, msg: MessageFromChildCallback, error: Error) {
			sendReply(instance, msg.cmdId, error)
		}
		function onMessage (instance: ChildInstance, m: MessageFromChild) {
			if (m.cmd === MessageType.REPLY) {
				let msg: MessageFromChildReply = m
				const child = instance.child
				let cb = child.queue[msg.replyTo + '']
				if (!cb) throw Error('cmdId "' + msg.cmdId + '" not found!')
				if (msg.error) {
					cb(instance, msg.error)
				} else {
					cb(instance, null, msg.reply)
				}
				delete child.queue[msg.replyTo + '']
			} else if (m.cmd === MessageType.LOG) {
				let msg: MessageFromChildLog = m
				console.log.apply(null, ['LOG'].concat(msg.log))
			} else if (m.cmd === MessageType.CALLBACK) {
				let msg: MessageFromChildCallback = m
				let callback = instance.child.callbacks[msg.callbackId]
				if (callback) {
					Promise.resolve(callback(...msg.args))
					.then((result: any) => {
						sendReply(
							instance,
							msg.cmdId,
							undefined,
							result
						)
					})
					.catch((err: Error) => {
						replyError(instance, msg, err)
					})
				} else throw Error('callback "' + msg.callbackId + '" not found')
			}
		}
		function fixArgs (child: Child, ...args: any[]): ArgDefinition[] {
			return args.map((arg): ArgDefinition => {
				if (arg instanceof Buffer) return { type: 'Buffer', value: arg.toString('hex') }
				if (typeof arg === 'string') return { type: 'string', value: arg }
				if (typeof arg === 'number') return { type: 'number', value: arg }
				if (typeof arg === 'function') {
					const callbackId = child.callbackId++
					child.callbacks[callbackId + ''] = arg
					return { type: 'function', value: callbackId + '' }
				}
				return { type: 'other', value: arg }
			})
		}
		sendInit(instanceInChild, config, (instance: ChildInstance, err: Error | null, props: InitProps) => {
			if (err) {
				reject(err)
			} else {
				props.forEach((p: InitProp) => {
					if (!instance.child.alive) throw Error('Child process has been closed')

					if (proxy.hasOwnProperty(p.key)) {
						// console.log('skipping property ' + p.key)
						return
					}
					if (p.type === InitPropType.FUNCTION) {
						// @ts-ignore proxy is a class
						const fcn = (...args: any[]) => {
							return new Promise((resolve, reject) => {
								// go through arguments and serialize them:
								let fixedArgs = fixArgs(instance.child, ...args)
								sendFcn(
									instance,
									p.key,
									fixedArgs,
									(_instance, err, res) => {
										if (err) reject(err)
										else resolve(res)
									}
								)
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
									sendFcn(
										instance,
										p.key,
										[],
										(_instance, err, res) => {
											if (err) reject(err)
											else resolve(res)
										}
									)
								})
							}
						}
						if (
							p.descriptor.set ||
							p.descriptor.writable
						) {
							m.set = function (newVal) {
								let fixedArgs = fixArgs(instance.child, newVal)

								// in the strictest of worlds, we sould block the main thread here,
								// until the remote acknowledges the write.
								// Instead we're going to pretend that everything is okay. *whistling*
								sendSet(
									instance,
									p.key,
									fixedArgs[0],
									(_instance, err, _result) => {
										if (err) {
											console.log('Error in setter', err)
										}
									}
								)
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
