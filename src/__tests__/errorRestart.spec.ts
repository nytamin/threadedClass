import {
	Promisify,
	threadedClass,
	ThreadedClassConfig,
	ThreadedClassManager
} from '../index'
import { TestClassErrors } from '../../test-lib/testClassErrors'
import { RegisterExitHandlers } from '../parent-process/manager'
import { tmpdir } from 'os'
import { join } from 'path'
import { promises } from 'fs'
const TESTCLASS_PATH = '../../test-lib/testClassErrors.js'

const DEBUG = false

describe('threadedclass', () => {
	const TMP_STATE_FILES: string[] = []
	let fileCount = 0

	function getStateFile () {
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

		try {
			await ThreadedClassManager.destroyAll()
		} catch (e) {
			// console.log('Could not close class proxy')
		}
	})

	afterEach(async () => {
		await sleep(200)
	})

	test('restart after error', async () => {

		const {
			threaded,
			onClosed,
			onError,
			onRestarted
		} = await setupErrorClassInstance([{}], {
			autoRestart: true,
			threadUsage: 1
		})

		await crashChild(threaded, onClosed, onError)

		await waitExpectMockCall(onRestarted)

		let counter = 0
		await threaded.on('test', () => {
			counter = 1
		})
		expect(threaded.emitEvent('test'))
		await sleep(10)
		expect(counter).toEqual(1)

		await crashChild(threaded, onClosed, onError)

		await waitExpectMockCall(onRestarted)

		await sleep(1000)

		expect(threaded.emitEvent('test'))
		await sleep(10)
		expect(counter).toEqual(1) // the underlying class has been reset, so we shouldn't expect to have the event handler registered

		await ThreadedClassManager.destroyAll()
		expect(ThreadedClassManager.getThreadCount()).toEqual(0)
	})

	test('emit error if constructor crashes on subsequent restart', async () => {
		const {
			threaded,
			onClosed,
			onError
		} = await setupErrorClassInstance([{
			failInConstructorAfter: 1,
			counterFile: getStateFile()
		}], {
			autoRestart: true,
			threadUsage: 1,
			restartTimeout: 200
		})

		await crashChild(threaded, onClosed, onError)
		await waitExpectMockCall(onError, (args) => {
			expect(args[0]).toMatch(/Error in constructor/)
		})
	})
	test('Manually restart instance', async () => {
		const KILL_TIMEOUT = 100

		const {
			threaded,
			onClosed,
			onError,
			onRestarted
		} = await setupErrorClassInstance([{}], {
			autoRestart: true,
			threadUsage: 1,
			restartTimeout: 200,
			killTimeout: KILL_TIMEOUT
		})

		await ThreadedClassManager.restart(threaded, true)

		await waitExpectMockCall(onClosed)
		expect(onRestarted).toHaveBeenCalledTimes(0) // because it was manually restarted
		expect(onError).toHaveBeenCalledTimes(0)

		// Wait long enough so that any timeouts have run:
		await sleep(100 + KILL_TIMEOUT)

		// Restart it again, to ensure that the proxy is still found:
		await ThreadedClassManager.restart(threaded, true)

		await waitExpectMockCall(onClosed)
		expect(onError).toHaveBeenCalledTimes(0)

	})

	test('emit error if constructor times out on subsequent restart', async () => {
		const RESTART_TIME = 100

		const {
			threaded,
			onClosed,
			onError
		} = await setupErrorClassInstance([{
			busyConstructorAfter: 1,
			busyConstructorTimeMs: RESTART_TIME + 50,
			counterFile: getStateFile()
		}], {
			autoRestart: true,
			threadUsage: 1,
			restartTimeout: RESTART_TIME
		})

		await crashChild(threaded, onClosed, onError)

		await waitExpectMockCall(onError, (args) => {
			expect(args[0].name).toBe('RestartTimeoutError')
		})

	})

	test('0 disables restartTimeout', async () => {
		const RESTART_TIME = 1500

		const {
			threaded,
			onClosed,
			onError,
			onRestarted
		} = await setupErrorClassInstance([{
			busyConstructorAfter: 1,
			busyConstructorTimeMs: RESTART_TIME,
			counterFile: getStateFile()
		}], {
			autoRestart: true,
			threadUsage: 1,
			restartTimeout: 0,
			freezeLimit: RESTART_TIME + 1000
		})

		await crashChild(threaded, onClosed, onError)

		await sleep(RESTART_TIME + 500)

		expect(onRestarted).toHaveBeenCalledTimes(1)

		expect(await threaded.returnValue('test')).toBe('test')
	})

	test('does not retry restarting instance after timeout in constructor', async () => {
		const RESTART_TIME = 200

		const {
			threaded,
			onError,
			onRestarted,
			onClosed
		} = await setupErrorClassInstance([{
			busyConstructorAfter: 1,
			busyConstructorTimeMs: RESTART_TIME + 50,
			counterFile: getStateFile()
		}], {
			autoRestart: true,
			threadUsage: 1,
			autoRestartRetryDelay: 500,
			restartTimeout: RESTART_TIME
		})

		await crashChild(threaded, onClosed, onError)
		await waitExpectMockCall(onError)

		await sleep(RESTART_TIME + 200)

		expect(onRestarted).toHaveBeenCalledTimes(0)
		await expect(threaded.returnValue('test')).rejects.toMatch(/closed/i)

	})

	test('autoRestartRetryCount=1 retries restarting instance exactly once', async () => {
		const RESTART_TIME = 200

		const {
			threaded,
			onWarning,
			onError,
			onClosed
		} = await setupErrorClassInstance([{
			busyConstructorAfter: 1,
			busyConstructorCount: 999,
			busyConstructorTimeMs: RESTART_TIME + 100,
			counterFile: getStateFile()
		}], {
			autoRestart: true,
			threadUsage: 1,
			autoRestartRetryCount: 1,
			autoRestartRetryDelay: 500,
			restartTimeout: RESTART_TIME
		})

		// We expect the following events to happen:
		// 1. error from threaded.doAsyncError (crash + restart)
		// 3. error when trying to restart child (giving up)
		await crashChild(threaded, onClosed, onError)

		await waitExpectMockCall(onError, (args) => {
			expect(args[0].toString()).toMatch(/Timeout when trying to restart/)
			expect(args[0].name).toBe('RestartTimeoutError')
		})
		expect(onWarning).toHaveBeenCalledTimes(0)
	})
	test('autoRestartRetryCount=3 retries restarting instance exactly three times', async () => {
		const RESTART_TIME = 200

		const {
			threaded,
			onWarning,
			onError,
			onClosed
		} = await setupErrorClassInstance([{
			busyConstructorAfter: 1,
			busyConstructorCount: 999,
			busyConstructorTimeMs: RESTART_TIME + 100,
			counterFile: getStateFile()
		}], {
			autoRestart: true,
			threadUsage: 1,
			autoRestartRetryCount: 3,
			autoRestartRetryDelay: 100,
			restartTimeout: RESTART_TIME
		})

		// We expect the following events to happen:
		// 1. error from threaded.doAsyncError (crash + first restart)
		// 2. warning when trying to restart child (trying restart again)
		// 3. warning when trying to restart child (trying restart again)
		// 4. error when trying to restart child (giving up)
		await crashChild(threaded, onClosed, onError)

		await waitExpectMockCall(onWarning, (args) => {
			expect(args[0].toString()).toMatch(/Error when restarting child/)
		})
		await waitExpectMockCall(onWarning, (args) => {
			expect(args[0].toString()).toMatch(/Error when restarting child/)
		})
		expect(onError).toHaveBeenCalledTimes(0) // no errors should have been emitted yet

		await waitExpectMockCall(onError, (args) => {
			expect(args[0].toString()).toMatch(/Timeout when trying to restart/)
			expect(args[0].name).toBe('RestartTimeoutError')
		})

	})
	test('autoRestartRetryCount=2 retries restarting instance after timeout in constructor', async () => {
		const RESTART_TIME = 200

		const {
			threaded,
			onWarning,
			onError,
			onRestarted,
			onClosed
		} = await setupErrorClassInstance([{
			busyConstructorAfter: 1,
			busyConstructorTimeMs: RESTART_TIME + 100,
			counterFile: getStateFile()
		}], {
			autoRestart: true,
			threadUsage: 1,
			autoRestartRetryCount: 2,
			autoRestartRetryDelay: 500,
			restartTimeout: RESTART_TIME
		})

		await crashChild(threaded, onClosed, onError)

		await waitExpectMockCall(onWarning, (args) => {
			expect(args[0].toString()).toMatch(/Error when restarting child/)
		})
		expect(onError).toHaveBeenCalledTimes(0) // no errors should have been emitted yet

		// restarts succesfully on 2nd attempt
		await waitExpectMockCall(onRestarted)

		expect(await threaded.returnValue('test1')).toBe('test1')

		// Do the same thing again:
		await crashChild(threaded, onClosed, onError)

		// restarts succesfully again
		await waitExpectMockCall(onRestarted)
		expect(await threaded.returnValue('test2')).toBe('test2')

		expect(onError).toHaveBeenCalledTimes(0) // no errors should have been emitted
	})

	test('autoRestartRetryCount=2 retries restarting instance after error in constructor', async () => {

		const {
			threaded,
			onClosed,
			onWarning,
			onError,
			onRestarted
		} = await setupErrorClassInstance([{
			failInConstructorAfter: 1, counterFile: getStateFile()
		}], {
			autoRestart: true,
			threadUsage: 1,
			autoRestartRetryCount: 2,
			autoRestartRetryDelay: 500,
			restartTimeout: 200
		})

		await crashChild(threaded, onClosed, onError)

		await waitExpectMockCall(onWarning)
		await waitExpectMockCall(onRestarted)

		expect(await threaded.returnValue('test')).toBe('test')
	})

	test('autoRestartRetryCount=2 retries restarting instance after timeout in constructor no more than twice', async () => {
		const RESTART_TIME = 100

		const {
			threaded,
			onClosed,
			onWarning,
			onError,
			onRestarted
		} = await setupErrorClassInstance([{
			busyConstructorAfter: 1,
			busyConstructorCount: 2,
			busyConstructorTimeMs: RESTART_TIME + 100,
			counterFile: getStateFile()
		}], {
			autoRestart: true,
			threadUsage: 1,
			autoRestartRetryCount: 2,
			autoRestartRetryDelay: 500,
			restartTimeout: RESTART_TIME
		})

		await crashChild(threaded, onClosed, onError)

		await waitExpectMockCall(onClosed)
		await waitExpectMockCall(onClosed)

		await waitExpectMockCall(onWarning, (args) => {
			expect(args[0]).toMatch(/Error when restarting child/)
		})
		await waitExpectMockCall(onError, (args) => {
			expect(args[0].name).toBe('RestartTimeoutError')
		})

		expect(onRestarted).toHaveBeenCalledTimes(0)

		await expect(ThreadedClassManager.restart(threaded)).rejects.toThrow(/not found/)
	})

	test('manual restart after error in constructor is impossible (cleanup works)', async () => {
		const {
			threaded,
			onClosed,
			onError,
			onRestarted
		} = await setupErrorClassInstance([{
			failInConstructorAfter: 1,
			counterFile: getStateFile()
		}], {
			autoRestart: true,
			threadUsage: 1,
			restartTimeout: 200
		})

		await crashChild(threaded, onClosed, onError)
		await waitExpectMockCall(onClosed)
		await waitExpectMockCall(onError, (args) => {
			expect(args[0]).toMatch(/Error in constructor/)
		})

		await sleep(300)

		expect(onRestarted).toHaveBeenCalledTimes(0)

		await expect(ThreadedClassManager.restart(threaded)).rejects.toThrow(/not found/)
	})
})

function sleep (ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms))
}

async function setupErrorClassInstance (
	constr: ConstructorParameters<typeof TestClassErrors>,
	config: ThreadedClassConfig
) {
	const threaded = await threadedClass<TestClassErrors, typeof TestClassErrors>(TESTCLASS_PATH, 'TestClassErrors', constr, config)
	const onClosed = jest.fn(() => {
		// oh dear, the process was closed
		if (DEBUG) console.log('closed')
	})
	const onWarning = jest.fn((_w) => {
		// we received a warning
		if (DEBUG) console.log('warning', _w)
	})
	const onError = jest.fn((_e) => {
		// we had a global uncaught error
		if (DEBUG) console.log('error', _e)
	})
	const onRestarted = jest.fn(() => {
		// the thread was restarted
		if (DEBUG) console.log('restarted')
	})

	ThreadedClassManager.onEvent(threaded, 'thread_closed', onClosed)
	ThreadedClassManager.onEvent(threaded, 'warning', onWarning)
	ThreadedClassManager.onEvent(threaded, 'error', onError)
	ThreadedClassManager.onEvent(threaded, 'restarted', onRestarted)

	expect(await threaded.returnValue('test')).toBe('test')
	await sleep(10)
	expect(onClosed).toHaveBeenCalledTimes(0)
	expect(onWarning).toHaveBeenCalledTimes(0)
	expect(onError).toHaveBeenCalledTimes(0)
	expect(onRestarted).toHaveBeenCalledTimes(0)

	return {
		threaded,
		onClosed,
		onWarning,
		onError,
		onRestarted
	}
}

/**
 * Wait for mock function to have been called.
 * This clears the mock function as well as checking it. To verify the mock arguments, provide a @checkCallback callback
 */
async function waitExpectMockCall (mockFcn: jest.Mock<void, any>, checkCallback?: (args: any[]) => void) {
	if (mockFcn.mock.calls.length > 1) throw new Error(`waitExpectMockCall: ${mockFcn.name} have already been called ${mockFcn.mock.calls.length} times`)

	const maxWaitTime = 1000

	const step = 10
	let i = 0
	while (true) {
		if (mockFcn.mock.calls.length >= 1) break
		i += step
		await sleep(step)

		if (i >= maxWaitTime) {
			throw new Error(`Timeout after ${i}ms when waiting for ${mockFcn.name} to be called.`)
		}
	}
	expect(mockFcn).toHaveBeenCalledTimes(1)
	if (checkCallback) checkCallback(mockFcn.mock.calls[0])

	mockFcn.mockClear()
}
/**
 * Crash the child thread
 */
async function crashChild (
	threaded: Promisify<TestClassErrors>,
	onClosed: jest.Mock<void, []>,
	onError: jest.Mock<void, [_e: any]>
	) {

	expect(await threaded.doAsyncError()).toBeDefined()
	await waitExpectMockCall(onClosed)

	if (process.version.startsWith('v10.')) {
		// In Node 10, errors in setTimeout are only logged
		expect(onError).toHaveBeenCalledTimes(0)
	} else {
		await waitExpectMockCall(onError, (args) => {
			expect(args[0].toString()).toMatch(/is not defined/)
		})
	}
}
