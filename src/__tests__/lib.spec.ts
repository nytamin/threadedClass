import {
	isBrowser,
	browserSupportsWebWorkers,
	nodeSupportsWorkerThreads,
	getWorkerThreads
} from '../lib'
import { ThreadedClassManager } from '..'
import { ThreadMode } from '../manager'

describe('lib', () => {
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
})
