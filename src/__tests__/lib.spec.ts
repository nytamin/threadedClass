import {
	isBrowser,
	isNodeJS,
	browserSupportsWebWorkers
} from '../lib'

describe('lib', () => {
	test('isBrowser', () => {
		expect(isBrowser()).toEqual(false)
	})
	test('isNodeJS', () => {
		expect(isNodeJS()).toEqual(true)
	})
	test('browserSupportsWebWorkers', () => {
		expect(browserSupportsWebWorkers()).toEqual(false)
	})
})
