import * as path from 'path'
import * as callsites from 'callsites'
import { isBrowser, browserSupportsWebWorkers, combineErrorStacks } from '../shared/lib'
import {
	InitProps,
	InitProp,
	InitPropType,
	ArgDefinition,
	decodeArguments,
	encodeArguments,
	Message
} from '../shared/sharedApi'
import {
	ThreadedClass,
	ThreadedClassConfig
} from '../api'
import { ThreadedClassManagerInternal, ChildInstance, Child, InstanceCallbackFunction } from './manager'

// From: https://github.com/Morglod/tsargs/blob/master/lib/ctor-args.ts
type CtorArgs<CtorT extends new (...args: any) => any> = CtorT extends new (...args: infer K) => any ? K : never

/**
 * Returns an asynchronous version of the provided class
 * @param orgModule Path to imported module (this is what is in the require('XX') function, or import {class} from 'XX'} )
 * @param orgExport Name of export in module
 * @param constructorArgs An array of arguments to be fed into the class constructor
 */
export function threadedClass<T, TCtor extends new (...args: any) => T> (
	orgModule: string,
	orgExport: string,
	constructorArgs: CtorArgs<TCtor>,
	configOrg: ThreadedClassConfig = {}
): Promise<ThreadedClass<T>> {
	let exportName: string = orgExport

	/** Used to  extrack the original stack */
	const errStack = new Error()

	if (typeof orgModule as any !== 'string') throw new Error('threadedClass parameter orgModule must be a string!')
	if (typeof orgExport as any !== 'string') throw new Error('threadedClass parameter orgExport must be a string!')

	const config: ThreadedClassConfig = {
		...configOrg,
		instanceName: configOrg.instanceName || orgExport // Default to the export class name
	}

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
			let msg: Message.To.Instance.FcnConstr = {
				cmd: Message.To.Instance.CommandType.FUNCTION,
				fcn: fcn,
				args: args
			}
			ThreadedClassManagerInternal.sendMessageToInstance(instance, msg, cb)
		}
		function sendSet (instance: ChildInstance, property: string, value: ArgDefinition, cb?: InstanceCallbackFunction) {
			let msg: Message.To.Instance.SetConstr = {
				cmd: Message.To.Instance.CommandType.SET,
				property: property,
				value: value
			}
			ThreadedClassManagerInternal.sendMessageToInstance(instance, msg, cb)
		}
		function sendReplyToInstance (instance: ChildInstance, replyTo: number, error?: Error, reply?: any, cb?: InstanceCallbackFunction) {
			let msg: Message.To.Instance.ReplyConstr = {
				cmd: Message.To.Instance.CommandType.REPLY,
				replyTo: replyTo,
				reply: reply,
				error: error ? (error.stack || error).toString() : error
			}
			ThreadedClassManagerInternal.sendMessageToInstance(instance, msg, cb)
		}
		function replyError (instance: ChildInstance, msg: Message.From.Instance.Callback, error: Error) {
			sendReplyToInstance(instance, msg.cmdId, error)
		}
		function sendCallback (instance: ChildInstance, callbackId: string, args: any[], cb?: InstanceCallbackFunction) {
			let msg: Message.To.Instance.CallbackConstr = {
				cmd: Message.To.Instance.CommandType.CALLBACK,
				callbackId: callbackId,
				args: args
			}
			ThreadedClassManagerInternal.sendMessageToInstance(instance, msg, cb)
		}
		function decodeResultFromWorker (instance: ChildInstance, encodedResult: any) {
			return decodeArguments(() => instance.proxy, [encodedResult], (a: ArgDefinition) => {
				const callbackId = a.value[0]
				const count = a.value[1]

				let callback = instance.child.remoteFns[callbackId]?.ref.deref()
				if (!callback) {
					callback = (...args: any[]) => {
						return new Promise((resolve, reject) => {
							// Function result function is called from parent
							sendCallback(
								instance,
								callbackId,
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
					instance.child.remoteFns[callbackId] = { ref: new WeakRef(callback), count }
					instance.child.finalizationRegistry.register(callback, callbackId)
				} else {
					instance.child.remoteFns[callbackId].count = count
				}
				return callback
			})[0]
		}
		function onMessageFromInstance (instance: ChildInstance, m: Message.From.Instance.Any) {
			if (m.cmd === Message.From.Instance.CommandType.REPLY) {
				let msg: Message.From.Instance.Reply = m
				const child = instance.child
				let cb: InstanceCallbackFunction = child.instanceMessageQueue[msg.replyTo + '']
				if (!cb) return
				if (msg.error) {
					cb(instance, msg.error)
				} else {
					cb(instance, null, msg.reply)
				}
				delete child.instanceMessageQueue[msg.replyTo + '']
			} else if (m.cmd === Message.From.Instance.CommandType.CALLBACK) {
				// Callback function is called by worker
				let msg: Message.From.Instance.Callback = m
				let callback = instance.child.callbacks.get(msg.callbackId)
				if (callback) {
					try {
						Promise.resolve(callback.fun(...msg.args))
						.then((result: any) => {
							let encodedResult = encodeArguments(instance, instance.child.callbacks, [result], !!config.disableMultithreading)
							sendReplyToInstance(
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
					.replace(/parent-process/,'child-process')
					.replace(/threadedClass(\.[tj]s)$/,'threadedclass-worker.js')
					.replace(/src([\\\/])child-process([\\\/])threadedclass-worker/,'dist$1child-process$2threadedclass-worker')
			}

			const child: Child = ThreadedClassManagerInternal.findNextAvailableChild(
				config,
				pathToWorker
			)

			const proxy = {} as ThreadedClass<T>

			let instanceInChild: ChildInstance = ThreadedClassManagerInternal.attachInstanceToChild(
				config,
				child,
				proxy,
				pathToModule,
				exportName,
				constructorArgs,
				onMessageFromInstance
			)

			ThreadedClassManagerInternal.sendInit(child, instanceInChild, config, (instance: ChildInstance, err: Error | null, props: InitProps) => {
				// This callback is called from the child process, with a list of supported properties of the instance
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

							const callMethod = (...args: any[]) => {
								// An instance method is called by parent

								const originalError = new Error()

								if (!instance.child) return Promise.reject(new Error(`Instance ${instance.id} has been detached from child process`))

								return ThreadedClassManagerInternal.doMethod(instance.child, p.key, (resolve, reject) => {
									if (!instance.child) throw new Error(`Instance ${instance.id} has been detached from child process`)
									// Go through arguments and serialize them:
									let encodedArgs = encodeArguments(instance, instance.child.callbacks, args, !!config.disableMultithreading)
									sendFcn(
										instance,
										p.key,
										encodedArgs,
										(_instance, err, encodedResult) => {
											// Function result is returned from child instance

											if (err) {
												err = combineErrorStacks(err, 'Original stack (on parent):', originalError.stack || '')
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
							proxy[p.key] = callMethod
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
												// hack, used in unit tests:
												;(proxy as any).__uncaughtError = err
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
					ThreadedClassManagerInternal.checkInstance(instanceInChild, errStack)
					return true
				}
			})
		} catch (e) {
			reject(e)
		}
	})
}
