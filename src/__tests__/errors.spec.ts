import {
	threadedClass,
	ThreadedClassManager,
	ThreadedClass
} from '../index'
import { TestClassErrors } from '../../test-lib/testClassErrors'
import { RegisterExitHandlers } from '../parent-process/manager'
import { cbError, cbReject, cbReturnBadValue } from './lib/errorCallbacks'
const TESTCLASS_PATH = '../../test-lib/testClassErrors.js'

const getTests = (disableMultithreading: boolean) => {
	return () => {

		let threaded: ThreadedClass<TestClassErrors>
		let onClosed = jest.fn()
		let onError = jest.fn()
		let onClosedListener: any
		let onErrorListener: any

		beforeAll(async () => {

			ThreadedClassManager.handleExit = RegisterExitHandlers.NO
			ThreadedClassManager.debug = false

			threaded = await threadedClass<TestClassErrors, typeof TestClassErrors>(TESTCLASS_PATH, 'TestClassErrors', [{}], { disableMultithreading })
			onClosedListener = ThreadedClassManager.onEvent(threaded, 'thread_closed', onClosed)
			onErrorListener = ThreadedClassManager.onEvent(threaded, 'error', onError)

		})
		beforeEach(() => {
			expect(threaded).toBeTruthy()
		})
		afterEach(() => {
			expect((threaded as any).__uncaughtError).toBeFalsy()
		})
		afterAll(async () => {
			await ThreadedClassManager.destroy(threaded)
			expect(ThreadedClassManager.getThreadCount()).toEqual(0)
			onClosedListener.stop()
			onErrorListener.stop()
			expect(onClosed).toHaveBeenCalledTimes(1)
		})

		test('Error in called method', async () => {

			await expect(threaded.doError()).rejects.toMatch(/TestError/)
			// ensure that the original path is included in the stack-trace:
			await expect(threaded.doError()).rejects.toMatch(/testClassErrors.js/)
			await expect(threaded.doError()).rejects.toMatch(/errors.spec/)
		})
		test('SyntaxError in called method', async () => {

			await expect(threaded.doSyntaxError()).rejects.toMatch(/SyntaxError/)
			// ensure that the original path is included in the stack-trace:
			await expect(threaded.doSyntaxError()).rejects.toMatch(/testClassErrors.js/)
			await expect(threaded.doSyntaxError()).rejects.toMatch(/errors.spec/)
		})
		test('Error in callback', async () => {
			// Pre-test: check that cbError throws an error:
			expect(returnError(cbError)).toMatch(/TestError in callback 123/)
			// ensure that the original path is included in the stack-trace:
			expect(returnError(cbError)).toMatch(/lib[\/\\]errorCallbacks/)
			expect(returnError(cbError)).toMatch(/errors.spec/)

			await expect(threaded.callCallback(cbError)).rejects.toMatch(/TestError in callback 123/)
			// ensure that the original path is included in the stack-trace:
			await expect(threaded.callCallback(cbError)).rejects.toMatch(/lib[\/\\]errorCallbacks/)
			await expect(threaded.callCallback(cbError)).rejects.toMatch(/errors.spec/)

			await expect(threaded.callCallback(cbReject)).rejects.toMatch(/Rejected promise 123/)
			// ensure that the original path is included in the stack-trace:
			await expect(threaded.callCallback(cbReject)).rejects.toMatch(/lib[\/\\]errorCallbacks/)
			await expect(threaded.callCallback(cbReject)).rejects.toMatch(/errors.spec/)

		})
		if (!disableMultithreading) {

			test('Error in unhandled promise', async () => {
				expect(await threaded.getUnhandledPromiseRejections()).toHaveLength(0)

				// This sets up an unhandled promise on in the child thread, and causes it to reject:
				await threaded.rejectUnhandledPromise()
				await sleep(100) // Ensure that the promise has been rejected

				const unhandled = await threaded.getUnhandledPromiseRejections()
				expect(unhandled).toHaveLength(1)
				expect(unhandled[0]).toMatch(/Rejecting promise/)
				expect(unhandled[0]).toMatch(/testClassErrors.js/)

				await threaded.clearUnhandledPromiseRejections()
			})

			test('Error in event listener', async () => {
				expect(await threaded.getUnhandledPromiseRejections()).toHaveLength(0)

				// Set up an event listener that throws an error, on the parent thread:
				await threaded.on('testEvent', () => {
					throw new Error('TestError in event listener')
				})

				// await expect(threaded.emitEvent('testEvent')).rejects.toMatch(/TestError in event listener/)
				await threaded.emitEvent('testEvent')

				await sleep(100) // Ensure that the unhandled promise has been caught

				// Because event emit/listeners don't handle promises, there should be an unhandled Promise rejection in the client:
				const unhandled = await threaded.getUnhandledPromiseRejections()
				expect(unhandled).toHaveLength(1)

				/*
				Error: TestError in event listener
					at threadedClass\src\__tests__\errors.spec.ts:84:11
					at Object.onMessageFromInstance [as onMessageCallback] (threadedClass\src\parent-process\threadedClass.ts:131:23)
					at TestClassErrors.emit (events.js:400:28)
					at TestClassErrors.emitEvent (threadedClass\test-lib\testClassErrors.js:18:14)
					at ThreadedWorker.handleInstanceMessageFromParent (threadedClass\dist\child-process\worker.js:311:34)
					...
				*/
				const errorLines = unhandled[0].split('\n')

				expect(errorLines[0]).toMatch(/TestError in event listener/)
				expect(errorLines[1]).toMatch(/errors.spec/)
				expect(errorLines[2]).toMatch(/threadedClass/)
				expect(errorLines[3]).toMatch(/emit/)
				expect(errorLines[4]).toMatch(/testClassErrors/)

				await threaded.clearUnhandledPromiseRejections()
			})

			const m = (process.version + '').match(/(\d+)\.(\d+)\.(\d+)/)
			if (
				m &&
				m[1] &&
				parseInt(m[1], 10) >= 11
			) {
				// DataCloneError is introduced in Node.js 11+
				test('Internal error when sending invalid value', async () => {

					let err: string | undefined
					try {
						await threaded.receiveValue({
							a: () => {
								// This is a function.
								// ThreadedClass doesn't support functions inside of objects.
								// Sending this will throw a DataCloneError.
							}
						})
					} catch (e) {
						if (typeof e === 'object') err = e.stack
						else err = `${e}`
					}

					expect(err).toMatch(/DataCloneError/)
					// ensure that the original path is included in the stack-trace:
					expect(err).toMatch(/errors.spec/)

				})
				test('Internal error when returning invalid value in callback', async () => {
					let err: string | undefined
					try {
						await threaded.callCallback(cbReturnBadValue)
					} catch (e) {
						if (typeof e === 'object') err = e.stack
						else err = `${e}`
					}

					expect(err).toMatch(/DataCloneError/)
					// ensure that the original path is included in the stack-trace:
					expect(err).toMatch(/errors.spec/)
				})
			}

			test('Error thrown in an setTimeout function', async () => {
				expect(onClosed).toHaveBeenCalledTimes(0)
				await expect(threaded.doAsyncError()).resolves.toBeTruthy()
				await sleep(100)
				expect(onClosed).toHaveBeenCalledTimes(1)

				if (!process.version.startsWith('v10.')) {
					// In Node 10, errors in setTimeout are only logged.
					expect(onError).toHaveBeenCalledTimes(1)
					expect(onError.mock.calls[0][0].message).toMatch(/DaleATuCuerpoAlegría/)
				}
			})
			// }
		}
	}
}

describe('threadedclass', getTests(false))
describe('threadedclass single thread', getTests(true))

function returnError (cb: () => any): string | null {

	try {
		cb()
	} catch (error) {
		let str = error.toString()
		if (typeof error === 'object') str += '\n' + error.stack
		return str
	}
	return null

}
function sleep (ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms))
}
