import {
	threadedClass,
	ThreadedClassManager
} from '../index'
import { House } from '../../test-lib/house'

import { RegisterExitHandlers } from '../parent-process/manager'

const HOUSE_PATH = '../../test-lib/house.js'

describe('strict mode', () => {

	beforeAll(() => {
		ThreadedClassManager.handleExit = RegisterExitHandlers.NO
		ThreadedClassManager.debug = false
	})
	const noop = () => {
		// Nothing
	}
	const orgConsoleLog = console.log
	const logSpy = jest.fn((...args) => {
		// Ignore
		if (`${args[0]}`.startsWith('ThreadedClass (')) return
		orgConsoleLog(...args)
	})
	beforeEach(async () => {
		console.log = logSpy
		logSpy.mockClear()
		ThreadedClassManager.strict = true
	})
	afterEach(async () => {
		await sleep(10)

		await ThreadedClassManager.destroyAll()
		expect(ThreadedClassManager.getThreadCount()).toEqual(0)

		logSpy.mockClear()
		ThreadedClassManager.strict = false
		console.log = orgConsoleLog
	})
	test('no events', async () => {
		const threaded = await threadedClass<House, typeof House>(HOUSE_PATH, 'House', [[], []], { })
		expect(await threaded.lamps).toBe(0)
		await sleep(10)

		expect(logSpy).toHaveBeenCalledTimes(3)
		expect(logSpy.mock.calls[0].join(' ')).toMatch(/No listener for the 'error' event/)
		expect(logSpy.mock.calls[1].join(' ')).toMatch(/No listener for the 'warning' event/)
		expect(logSpy.mock.calls[2].join(' ')).toMatch(/autoRestart is disabled and no listener for the 'thread_closed' event/)
	})
	test('restarted missing', async () => {
		const threaded = await threadedClass<House, typeof House>(HOUSE_PATH, 'House', [[], []], {
			autoRestart: true
		})
		ThreadedClassManager.onEvent(threaded, 'error', noop)
		ThreadedClassManager.onEvent(threaded, 'warning', noop)
		expect(await threaded.lamps).toBe(0)
		await sleep(10)

		expect(logSpy).toHaveBeenCalledTimes(1)
		expect(logSpy.mock.calls[0].join(' ')).toMatch(/No listener for the 'restarted' event/)
	})
	test('autoRestart: true', async () => {
		const threaded = await threadedClass<House, typeof House>(HOUSE_PATH, 'House', [[], []], {
			autoRestart: true
		})
		ThreadedClassManager.onEvent(threaded, 'error', noop)
		ThreadedClassManager.onEvent(threaded, 'warning', noop)
		ThreadedClassManager.onEvent(threaded, 'restarted', noop)
		expect(await threaded.lamps).toBe(0)
		await sleep(10)

		expect(logSpy).toHaveBeenCalledTimes(0)
	})
	test('autoRestart: false', async () => {
		const threaded = await threadedClass<House, typeof House>(HOUSE_PATH, 'House', [[], []], {
			autoRestart: false
		})
		ThreadedClassManager.onEvent(threaded, 'error', noop)
		ThreadedClassManager.onEvent(threaded, 'warning', noop)
		ThreadedClassManager.onEvent(threaded, 'thread_closed', noop)
		expect(await threaded.lamps).toBe(0)
		await sleep(10)

		expect(logSpy).toHaveBeenCalledTimes(0)
	})
})

function sleep (ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms))
}
