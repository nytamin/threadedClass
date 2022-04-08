import {
	isBrowser,
	browserSupportsWebWorkers,
	nodeSupportsWorkerThreads,
	getWorkerThreads,
	stripStack,
	combineErrorStacks
} from '../shared/lib'
import { ThreadedClassManager } from '..'
import { ThreadMode, RegisterExitHandlers } from '../parent-process/manager'
import { cbError } from './lib/errorCallbacks'

describe('lib', () => {
	beforeAll(() => {
		ThreadedClassManager.handleExit = RegisterExitHandlers.NO
		ThreadedClassManager.debug = false
	})
	console.log('process.version', process.version)
	const m = (process.version + '').match(/(\d+)\.(\d+)\.(\d+)/)
	if (
		m &&
		m[1] &&
		(
			parseInt(m[1], 10) > 11 ||
			(
				parseInt(m[1], 10) === 11 &&
				parseInt(m[2], 10) >= 8
			)
		)
	) {
		// In Node version 11.8, the worker_threads are supported by default

		test('isBrowser', () => {
			expect(isBrowser()).toEqual(false)
		})
		test('browserSupportsWebWorkers', () => {
			expect(browserSupportsWebWorkers()).toEqual(false)
		})
		test('nodeSupportsWorkerThreads', () => {
			expect(nodeSupportsWorkerThreads()).toEqual(true)
		})
		test('getWorkerThreads', () => {
			expect(getWorkerThreads()).toBeTruthy()
		})
		test('getWorkerThreads', () => {
			expect(ThreadedClassManager.getThreadMode()).toEqual(ThreadMode.WORKER_THREADS)
		})
	} else {
		test('isBrowser', () => {
			expect(isBrowser()).toEqual(false)
		})
		test('browserSupportsWebWorkers', () => {
			expect(browserSupportsWebWorkers()).toEqual(false)
		})
		test('nodeSupportsWorkerThreads', () => {
			expect(nodeSupportsWorkerThreads()).toEqual(false)
		})
		test('getWorkerThreads', () => {
			expect(getWorkerThreads()).toEqual(null)
		})
		test('getWorkerThreads', () => {
			expect(ThreadedClassManager.getThreadMode()).toEqual(ThreadMode.CHILD_PROCESS)
		})
	}

	test('stripStack', () => {
		const err = new Error('test error 123')

		// This is the error this unit test is built to handle, we might have adjust it in the future if the
		// internals of the jest library change:
		/*
		 Error: test error 123
          at Object.<anonymous> (threadedClass\src\__tests__\lib.spec.ts:65:15)
          at Object.asyncJestTest (threadedClass\node_modules\jest-jasmine2\build\jasmineAsyncInstall.js:100:37)
          at threadedClass\node_modules\jest-jasmine2\build\queueRunner.js:45:12
          at new Promise (<anonymous>)
          at mapper (threadedClass\node_modules\jest-jasmine2\build\queueRunner.js:28:19)
          at threadedClass\node_modules\jest-jasmine2\build\queueRunner.js:75:41
          at processTicksAndRejections (internal/process/task_queues.js:95:5)
		*/
		expect(err.stack).toMatch(/test error 123/)
		expect(err.stack).toMatch(/lib.spec/)
		// Match something on each line:
		const stripRegex = [
			/jasmineAsyncInstall/,
			/queueRunner/
		]
		// Just do a check to ensure that stripRegex is correct:
		for (const regex of stripRegex) {
			expect(err.stack).toMatch(regex)
		}

		const stripped: string = stripStack(err.stack + '', stripRegex)

		// We're expecting something like this:
		/*
		 Error: test error 123
          at Object.<anonymous> (threadedClass\src\__tests__\lib.spec.ts:65:15)
		*/

		expect(stripped).toMatch(/test error 123/)
		expect(stripped).toMatch(/lib.spec/)
		expect(stripped).not.toMatch(/jasmineAsyncInstall/)
		expect(stripped.split('\n')).toHaveLength(2)
	})
	test('combineErrorStacks', () => {
		const err = new Error('test error 123')
		let err2: any = null
		try {
			cbError()
		} catch (e) {
			err2 = e
		}
		// Verify that the errors contains the expected stacks:
		expect(err.stack).toMatch(/test error 123/)
		expect(err.stack).toMatch(/lib.spec/)

		expect(err2.stack).toMatch(/TestError in callback 123/)
		expect(err2.stack).toMatch(/errorCallbacks.ts/)

		// Combine the two errors:
		const combinedErr = combineErrorStacks(err, err2.stack)

		const stack = combinedErr.stack
		expect(stack).toMatch(/test error 123/)
		expect(stack).toMatch(/lib.spec/)

		expect(stack).toMatch(/TestError in callback 123/)
		expect(stack).toMatch(/errorCallbacks.ts/)
	})
})
