import * as path from 'path'
import * as callsites from 'callsites'
import {
	InitProps,
	InitProp,
	InitPropType,
	MessageType,
	InstanceCallbackFunction,
	MessageFcnConstr,
	MessageSetConstr,
	MessageReplyConstr,
	MessageFromChildCallback,
	MessageFromChild,
	MessageFromChildReply,
	ArgDefinition,
	decodeArguments,
	encodeArguments,
	MessageCallbackConstr
} from './internalApi'
import {
	ThreadedClass,
	ThreadedClassConfig
} from './api'
import { ThreadedClassManagerInternal, ChildInstance, Child } from './manager'
import { isBrowser, browserSupportsWebWorkers } from './lib'

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
	let orgClassName: string = orgClass.name

	if (isBrowser()) {
		if (!config.pathToWorker) {
			throw Error('config.pathToWorker is required in browser')
		}
		if (!browserSupportsWebWorkers()) {
			console.log('Web-workers not supported, disabling multi-threading')
			config.disableMultithreading = true
		}
	}
	let parentCallPath = callsites()[1].getFileName()
	let thisCallPath = callsites()[0].getFileName()

	return new Promise<ThreadedClass<T>>((resolve, reject) => {
		function sendFcn (instance: ChildInstance, fcn: string, args: any[], cb?: InstanceCallbackFunction) {
			let msg: MessageFcnConstr = {
				cmd: MessageType.FUNCTION,
				fcn: fcn,
				args: args
			}
			ThreadedClassManagerInternal.sendMessageToChild(instance, msg, cb)
		}
		function sendSet (instance: ChildInstance, property: string, value: ArgDefinition, cb?: InstanceCallbackFunction) {
			let msg: MessageSetConstr = {
				cmd: MessageType.SET,
				property: property,
				value: value
			}
			ThreadedClassManagerInternal.sendMessageToChild(instance, msg, cb)
		}
		function sendReply (instance: ChildInstance, replyTo: number, error?: Error, reply?: any, cb?: InstanceCallbackFunction) {
			let msg: MessageReplyConstr = {
				cmd: MessageType.REPLY,
				replyTo: replyTo,
				reply: reply,
				error: error ? (error.stack || error).toString() : error
			}
			ThreadedClassManagerInternal.sendMessageToChild(instance, msg, cb)
		}
		function replyError (instance: ChildInstance, msg: MessageFromChildCallback, error: Error) {
			sendReply(instance, msg.cmdId, error)
		}
		function sendCallback (instance: ChildInstance, callbackId: string, args: any[], cb?: InstanceCallbackFunction) {
			let msg: MessageCallbackConstr = {
				cmd: MessageType.CALLBACK,
				callbackId: callbackId,
				args: args
			}
			ThreadedClassManagerInternal.sendMessageToChild(instance, msg, cb)
		}
		function decodeResultFromWorker (instance: ChildInstance, encodedResult: any) {
			return decodeArguments(instance.proxy, [encodedResult], (a: ArgDefinition) => {
				return (...args: any[]) => {
					return new Promise((resolve, reject) => {
						// Function result function is called from parent
						sendCallback(
							instance,
							a.value,
							args, (_instance, err, encodedResult) => {
								// Function result is returned from worker
								if (err) {
									reject(err)
								} else {
									let result = decodeResultFromWorker(_instance, encodedResult)
									resolve(result)
								}
							}
						)
					})
				}
			})[0]
		}
		function onMessage (instance: ChildInstance, m: MessageFromChild) {
			if (m.cmd === MessageType.REPLY) {
				let msg: MessageFromChildReply = m
				const child = instance.child
				let cb: InstanceCallbackFunction = child.queue[msg.replyTo + '']
				if (!cb) return
				if (msg.error) {
					cb(instance, msg.error)
				} else {
					cb(instance, null, msg.reply)
				}
				delete child.queue[msg.replyTo + '']
			} else if (m.cmd === MessageType.CALLBACK) {
				// Callback function is called by worker
				let msg: MessageFromChildCallback = m
				let callback = instance.child.callbacks[msg.callbackId]
				if (callback) {
					try {
						Promise.resolve(callback(...msg.args))
						.then((result: any) => {
							let encodedResult = encodeArguments(instance, instance.child.callbacks, [result], !!config.disableMultithreading)
							sendReply(
								instance,
								msg.cmdId,
								undefined,
								encodedResult[0]
							)
						})
						.catch((err: Error) => {
							replyError(instance, msg, err)
						})
					} catch (err) {
						replyError(instance, msg, err)
					}
				} else throw Error(`callback "${msg.callbackId}" not found in instance ${m.instanceId}`)
			}
		}
		try {
			let pathToModule: string = ''
			let pathToWorker: string = ''
			if (isBrowser()) {
				pathToWorker = config.pathToWorker as string
				pathToModule = orgModule
			} else {

				if (!parentCallPath) throw new Error('Unable to resolve parent file path')
				if (!thisCallPath) throw new Error('Unable to resolve own file path')

				let absPathToModule = (
					orgModule.match(/^\./) ?
					path.resolve(parentCallPath, '../', orgModule) :
					orgModule
				)
				pathToModule = require.resolve(absPathToModule)

				pathToWorker = thisCallPath
					.replace(/threadedClass(\.[tj]s)$/,'threadedclass-worker.js')
					.replace(/src([\\\/])threadedclass-worker/,'dist$1threadedclass-worker')
			}

			const child: Child = ThreadedClassManagerInternal.getChild(
				config,
				pathToWorker
			)

			const proxy = {} as ThreadedClass<T>

			let instanceInChild: ChildInstance = ThreadedClassManagerInternal.attachInstance(
				config,
				child,
				proxy,
				pathToModule,
				orgClassName,
				orgClass,
				constructorArgs,
				onMessage
			)

			ThreadedClassManagerInternal.sendInit(child, instanceInChild, config, (instance: ChildInstance, err: Error | null, props: InitProps) => {
				// This callback is called from the worker process, with a list of supported properties of the c
				if (err) {
					reject(err)
					return false
				} else {
					props.forEach((p: InitProp) => {
						if (!instance.child.alive) throw Error(`Child process of instance ${instance.id} has been closed`)

						if (proxy.hasOwnProperty(p.key)) {
							return
						}
						if (p.type === InitPropType.FUNCTION) {

							const fcn = (...args: any[]) => {
								// An instance method is called by parent

								if (!instance.child) return Promise.reject(new Error(`Instance ${instance.id} has been detached from child process`))

								return ThreadedClassManagerInternal.doMethod(instance.child, (resolve, reject) => {
									if (!instance.child) throw new Error(`Instance ${instance.id} has been detached from child process`)
									// Go through arguments and serialize them:
									let encodedArgs = encodeArguments(instance, instance.child.callbacks, args, !!config.disableMultithreading)
									sendFcn(
										instance,
										p.key,
										encodedArgs,
										(_instance, err, encodedResult) => {
											// Function result is returned from worker

											if (err) {
												reject(err)
											} else {
												let result = decodeResultFromWorker(_instance, encodedResult)
												resolve(result)
											}
										}
									)
								})
							}
							// @ts-ignore
							proxy[p.key] = fcn
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
											(_instance, err, encodedResult) => {
												if (err) {
													reject(err)
												} else {
													let result = decodeResultFromWorker(_instance, encodedResult)
													resolve(result)
												}
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
									let fixedArgs = encodeArguments(instance, instance.child.callbacks, [newVal], !!config.disableMultithreading)

									// in the strictest of worlds, we should block the main thread here,
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
					ThreadedClassManagerInternal.startMonitoringChild(instanceInChild)
					resolve(proxy)
					return true
				}
			})
		} catch (e) {
			reject(e)
		}
	})
}
