import {
	threadedClass,
	ThreadedClassManager
} from '../index'
import { TestClassErrors } from '../../test-lib/testClassErrors'
import { RegisterExitHandlers } from '../parent-process/manager'
import { tmpdir } from 'os'
import { join } from 'path'
import { promises } from 'fs'
const TESTCLASS_PATH = '../../test-lib/testClassErrors.js'

describe('threadedclass', () => {
	const TMP_STATE_FILES: string[] = []
	let fileCount = 0

	function getStateFile() {
		const file = join(tmpdir(), 'test_state_' + fileCount++)
		TMP_STATE_FILES.push(file)
		return file
	}

	async function clearTestTempState (): Promise<void> {
		for (const file of TMP_STATE_FILES) {
			try {
				await promises.unlink(file)
			} catch {
				// don't do anything
			}
		}
	}

	beforeAll(async () => {

		ThreadedClassManager.handleExit = RegisterExitHandlers.NO
		ThreadedClassManager.debug = false

		await clearTestTempState()
	})

	afterAll(async () => {
		await clearTestTempState()
	})

	test('restart after error', async () => {
		const RESTART_TIME = 100

		let threaded = await threadedClass<TestClassErrors, typeof TestClassErrors>(TESTCLASS_PATH, 'TestClassErrors', [{}], {
			autoRestart: true,
			threadUsage: 1
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
		await sleep(100)
		expect(onClosed).toHaveBeenCalledTimes(1)
		if (process.version.startsWith('v10.')) {
			// In Node 10, errors in setTimeout are only logged
			expect(onError).toHaveBeenCalledTimes(0)
		} else {
			expect(onError).toHaveBeenCalledTimes(1)
		}

		await sleep(RESTART_TIME)

		let counter = 0
		await threaded.on('test', () => {
			counter = 1
		})
		expect(threaded.emitEvent('test'))
		await sleep(100)
		expect(counter).toEqual(1)
		expect(onRestarted).toHaveBeenCalledTimes(1)

		expect(await threaded.doAsyncError()).toBeTruthy()
		await sleep(100)
		expect(onClosed).toHaveBeenCalledTimes(2)

		await sleep(RESTART_TIME)

		expect(threaded.emitEvent('test'))
		await sleep(100)
		expect(counter).toEqual(1) // the underlying class has been reset, so we shouldn't expect to have the event handler registered

		await ThreadedClassManager.destroyAll()
		expect(ThreadedClassManager.getThreadCount()).toEqual(0)

		expect(onRestarted).toHaveBeenCalledTimes(2)
		expect(onClosed).toHaveBeenCalledTimes(3)
		expect(onRestarted).toHaveBeenCalledTimes(2)
		if (process.version.startsWith('v10.')) {
			// In Node 10, errors in setTimeout are only logged
			expect(onError).toHaveBeenCalledTimes(0)
		} else {
			expect(onError).toHaveBeenCalledTimes(2)
		}
	})

	test('emit error if constructor crashes on subsequent restart', async () => {
		const RESTART_TIME = 100

		let threaded = await threadedClass<TestClassErrors, typeof TestClassErrors>(TESTCLASS_PATH, 'TestClassErrors', [{ failInConstructorAfter: 1, counterFile: getStateFile() }], {
			autoRestart: true,
			threadUsage: 1,
			restartTimeout: 200
		})
		let onClosed = jest.fn(() => {
			// oh dear, the process was closed
		})
		const onError = jest.fn((_e) => {
			// we had a global uncaught error
		})
		const onRestarted = jest.fn(() => {
			// the thread was restarted
		})

		ThreadedClassManager.onEvent(threaded, 'thread_closed', onClosed)
		ThreadedClassManager.onEvent(threaded, 'error', onError)
		ThreadedClassManager.onEvent(threaded, 'restarted', onRestarted)

		expect(await threaded.returnValue('test')).toBe('test')
		await sleep(100)
		expect(onClosed).toHaveBeenCalledTimes(0)
		expect(onError).toHaveBeenCalledTimes(0)

		await sleep(RESTART_TIME)

		expect(await threaded.doAsyncError()).toBeDefined()

		await sleep(1000)

		expect(onClosed).toHaveBeenCalledTimes(2)
		if (process.version.startsWith('v10.')) {
			// In Node 10, errors in setTimeout are only logged
			expect(onError).toHaveBeenCalledTimes(1)
		} else {
			expect(onError).toHaveBeenCalledTimes(2)
		}
		expect(onError.mock.calls[onError.mock.calls.length - 1][0]).toMatch(/Error in constructor/)

		await sleep(500)

		try {
			await ThreadedClassManager.destroy(threaded)
		} catch (e) {
			// console.log('Could not close class proxy')
		}
	})
	test('Manually restart instance', async () => {
		const KILL_TIMEOUT = 100

		let threaded = await threadedClass<TestClassErrors, typeof TestClassErrors>(TESTCLASS_PATH, 'TestClassErrors', [{}], {
			autoRestart: true,
			threadUsage: 1,
			restartTimeout: 200,
			killTimeout: KILL_TIMEOUT
		})
		let onClosed = jest.fn(() => {
			// oh dear, the process was closed
		})
		const onError = jest.fn((_e) => {
			// we had a global uncaught error
		})
		const onRestarted = jest.fn(() => {
			// the thread was restarted
		})

		ThreadedClassManager.onEvent(threaded, 'thread_closed', onClosed)
		ThreadedClassManager.onEvent(threaded, 'error', onError)
		ThreadedClassManager.onEvent(threaded, 'restarted', onRestarted)

		expect(await threaded.returnValue('test')).toBe('test')
		await sleep(100)
		expect(onClosed).toHaveBeenCalledTimes(0)
		expect(onError).toHaveBeenCalledTimes(0)

		await ThreadedClassManager.restart(threaded, true)

		await sleep(100)

		expect(onRestarted).toHaveBeenCalledTimes(0) // because it was manually restarted
		expect(onClosed).toHaveBeenCalledTimes(1)
		expect(onError).toHaveBeenCalledTimes(0)

		// Wait long enough so that any timeouts have run:
		await sleep(100 + KILL_TIMEOUT)

		// Restart it again, to ensure that the proxy is still found:
		await ThreadedClassManager.restart(threaded, true)

		await sleep(100)

		expect(onClosed).toHaveBeenCalledTimes(2)
		expect(onError).toHaveBeenCalledTimes(0)

		try {
			await ThreadedClassManager.destroy(threaded)
		} catch (e) {
			// console.log('Could not close class proxy')
		}
	})

	test('emit error if constructor times out on subsequent restart', async () => {
		const RESTART_TIME = 100

		let threaded = await threadedClass<TestClassErrors, typeof TestClassErrors>(TESTCLASS_PATH, 'TestClassErrors', [{
			busyConstructorAfter: 1,
			busyConstructorTimeMs: RESTART_TIME+50,
			counterFile: getStateFile()
		}], {
			autoRestart: true,
			threadUsage: 1,
			restartTimeout: RESTART_TIME
		})
		let onClosed = jest.fn(() => {
			// oh dear, the process was closed
		})
		const onError = jest.fn((_e) => {
			// we had a global uncaught error
		})
		const onRestarted = jest.fn(() => {
			// the thread was restarted
		})

		ThreadedClassManager.onEvent(threaded, 'thread_closed', onClosed)
		ThreadedClassManager.onEvent(threaded, 'error', onError)
		ThreadedClassManager.onEvent(threaded, 'restarted', onRestarted)

		expect(await threaded.returnValue('test')).toBe('test')
		await sleep(100)
		expect(onClosed).toHaveBeenCalledTimes(0)
		expect(onError).toHaveBeenCalledTimes(0)

		await sleep(RESTART_TIME)

		expect(await threaded.doAsyncError()).toBeDefined()

		await sleep(1000)

		expect(onClosed).toHaveBeenCalledTimes(2)
		if (process.version.startsWith('v10.')) {
			// In Node 10, errors in setTimeout are only logged
			expect(onError).toHaveBeenCalledTimes(1)
		} else {
			expect(onError).toHaveBeenCalledTimes(2)
		}
		expect(onError.mock.calls[onError.mock.calls.length - 1][0].name).toBe('RestartTimeoutError')

		await sleep(500)

		try {
			await ThreadedClassManager.destroy(threaded)
		} catch (e) {
			// console.log('Could not close class proxy')
		}
	})
	
	test('0 disables restartTimeout', async () => {
		const RESTART_TIME = 1500

		let threaded = await threadedClass<TestClassErrors, typeof TestClassErrors>(TESTCLASS_PATH, 'TestClassErrors', [{
			busyConstructorAfter: 1,
			busyConstructorTimeMs: RESTART_TIME,
			counterFile: getStateFile()
		}], {
			autoRestart: true,
			threadUsage: 1,
			restartTimeout: 0
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

		expect(await threaded.returnValue('test')).toBe('test')
		await sleep(100)
		expect(onClosed).toHaveBeenCalledTimes(0)
		expect(onError).toHaveBeenCalledTimes(0)

		expect(await threaded.doAsyncError()).toBeDefined()

		await sleep(RESTART_TIME+500)

		expect(onClosed).toHaveBeenCalledTimes(0)
		if (process.version.startsWith('v10.')) {
			// In Node 10, errors in setTimeout are only logged
			expect(onError).toHaveBeenCalledTimes(0)
		} else {
			expect(onError).toHaveBeenCalledTimes(1)
		}
		expect(await threaded.returnValue('test')).toBe('test')

		await sleep(500)

		try {
			await ThreadedClassManager.destroy(threaded)
		} catch (e) {
			// console.log('Could not close class proxy')
		}
	})

	test('manually restart instance after timeout in constructor', async () => {
		const RESTART_TIME = 200

		let threaded = await threadedClass<TestClassErrors, typeof TestClassErrors>(TESTCLASS_PATH, 'TestClassErrors', [{
			busyConstructorAfter: 1,
			busyConstructorTimeMs:
			RESTART_TIME+50,
			counterFile: getStateFile()
		}], {
			autoRestart: true,
			threadUsage: 1,
			restartTimeout: RESTART_TIME
		})
		let onClosed = jest.fn(() => {
			// oh dear, the process was closed
		})
		const onError = jest.fn((_e) => {
			// we had a global uncaught error
		})
		const onRestarted = jest.fn(() => {
			// the thread was restarted
		})

		ThreadedClassManager.onEvent(threaded, 'thread_closed', onClosed)
		ThreadedClassManager.onEvent(threaded, 'error', onError)
		ThreadedClassManager.onEvent(threaded, 'restarted', onRestarted)

		expect(await threaded.returnValue('test')).toBe('test')
		await sleep(100)
		expect(onClosed).toHaveBeenCalledTimes(0)
		expect(onError).toHaveBeenCalledTimes(0)

		await sleep(RESTART_TIME)

		expect(await threaded.doAsyncError()).toBeDefined()

		await sleep(1000)

		if (process.version.startsWith('v10.')) {
			// In Node 10, errors in setTimeout are only logged
			expect(onError).toHaveBeenCalledTimes(1)
		} else {
			expect(onError).toHaveBeenCalledTimes(2)
		}

		await sleep(1000)

		expect(onRestarted).toHaveBeenCalledTimes(0)

		await ThreadedClassManager.restart(threaded)
		await sleep(RESTART_TIME)

		expect(await threaded.returnValue('test')).toBe('test')

		try {
			await ThreadedClassManager.destroy(threaded)
		} catch (e) {
			// console.log('Could not close class proxy')
		}
	})
	
	test('manually restart instance after error in constructor', async () => {
		const RESTART_TIME = 100

		let threaded = await threadedClass<TestClassErrors, typeof TestClassErrors>(TESTCLASS_PATH, 'TestClassErrors', [{ failInConstructorAfter: 1, counterFile: getStateFile() }], {
			autoRestart: true,
			threadUsage: 1,
			restartTimeout: 200
		})
		let onClosed = jest.fn(() => {
			// oh dear, the process was closed
		})
		const onError = jest.fn((_e) => {
			// we had a global uncaught error
		})
		const onRestarted = jest.fn(() => {
			// the thread was restarted
		})

		ThreadedClassManager.onEvent(threaded, 'thread_closed', onClosed)
		ThreadedClassManager.onEvent(threaded, 'error', onError)
		ThreadedClassManager.onEvent(threaded, 'restarted', onRestarted)

		expect(await threaded.returnValue('test')).toBe('test')
		await sleep(100)
		expect(onClosed).toHaveBeenCalledTimes(0)
		expect(onError).toHaveBeenCalledTimes(0)

		await sleep(RESTART_TIME)

		expect(await threaded.doAsyncError()).toBeDefined()

		await sleep(1000)

		expect(onClosed).toHaveBeenCalledTimes(2)
		if (process.version.startsWith('v10.')) {
			// In Node 10, errors in setTimeout are only logged
			expect(onError).toHaveBeenCalledTimes(1)
		} else {
			expect(onError).toHaveBeenCalledTimes(2)
		}
		expect(onError.mock.calls[onError.mock.calls.length - 1][0]).toMatch(/Error in constructor/)

		await sleep(500)

		expect(onRestarted).toHaveBeenCalledTimes(0)

		await ThreadedClassManager.restart(threaded)
		await sleep(RESTART_TIME)

		expect(await threaded.returnValue('test')).toBe('test')

		try {
			await ThreadedClassManager.destroy(threaded)
		} catch (e) {
			// console.log('Could not close class proxy')
		}
	})
})

function sleep (ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms))
}
