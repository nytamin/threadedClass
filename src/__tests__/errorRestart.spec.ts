import {
	threadedClass,
	ThreadedClassManager
} from '../index'
import { TestClassErrors } from '../../test-lib/testClassErrors'
import { RegisterExitHandlers } from '../parent-process/manager'
const TESTCLASS_PATH = '../../test-lib/testClassErrors.js'

describe('threadedclass', () => {
	beforeAll(async () => {

		ThreadedClassManager.handleExit = RegisterExitHandlers.NO
		ThreadedClassManager.debug = false

	})

	test('restart after error', async () => {
		const RESTART_TIME = 100

		let threaded = await threadedClass<TestClassErrors, typeof TestClassErrors>(TESTCLASS_PATH, 'TestClassErrors', [], {
			autoRestart: true,
			threadUsage: 0.5
		})
		let onClosed = jest.fn(() => {
			// oh dear, the process was closed
		})
		const onError = jest.fn(() => {
			// we had a global uncaught error
		})
		const onRestarted = jest.fn(() => {
			// the thread was restarted
		})

		ThreadedClassManager.onEvent(threaded, 'thread_closed', onClosed)
		ThreadedClassManager.onEvent(threaded, 'error', onError)
		ThreadedClassManager.onEvent(threaded, 'restarted', onRestarted)

		expect(await threaded.doAsyncError()).toBeTruthy()
		await sleep(10)
		expect(onClosed).toHaveBeenCalledTimes(1)
		expect(onError).toHaveBeenCalledTimes(1)

		await sleep(RESTART_TIME)

		let counter = 0
		await threaded.on('test', () => {
			counter = 1
		})
		expect(threaded.emitEvent('test'))
		await sleep(10)
		expect(counter).toEqual(1)
		expect(onRestarted).toHaveBeenCalledTimes(1)

		expect(await threaded.doAsyncError()).toBeTruthy()
		await sleep(10)
		expect(onClosed).toHaveBeenCalledTimes(2)
		expect(onError).toHaveBeenCalledTimes(2)

		await sleep(RESTART_TIME)

		expect(threaded.emitEvent('test'))
		await sleep(10)
		expect(counter).toEqual(1) // the underlying class has been reset, so we shouldn't expect to have the event handler registered

		await ThreadedClassManager.destroyAll()
		expect(ThreadedClassManager.getThreadCount()).toEqual(0)

		expect(onRestarted).toHaveBeenCalledTimes(2)
		expect(onClosed).toHaveBeenCalledTimes(3)
		expect(onError).toHaveBeenCalledTimes(2)
		expect(onRestarted).toHaveBeenCalledTimes(2)
	})
})

function sleep (ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms))
}
