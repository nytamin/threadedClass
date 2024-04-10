import {
	RegisterExitHandlers,
	threadedClass,
	ThreadedClassManager
} from '../index'
import { TestClassEdgeCases } from '../../test-lib/testClassEdgeCases'
import { ThreadedClassManagerInternal } from '../parent-process/manager'
const TESTCLASS_PATH = '../../test-lib/testClassEdgeCases.js'

describe('edgeCases', () => {
	const onManagerDebugLogError = jest.fn()

	beforeAll(async () => {
		ThreadedClassManager.debug = false
		ThreadedClassManager.handleExit = RegisterExitHandlers.NO

		ThreadedClassManagerInternal.debugLogError = onManagerDebugLogError
	})
	beforeEach(async () => {
		await ThreadedClassManager.destroyAll()
	})
	afterEach(async () => {
		await ThreadedClassManager.destroyAll()
		expect(onManagerDebugLogError).toHaveBeenCalledTimes(0)
	})
	afterAll(async () => {
		onManagerDebugLogError.mockRestore()
	})

	test('Child calls callback, then dies', async () => {
		// * Parent calls a child method
		// * In the child method, Child calls a callback
		// * Child dies while the callback is executing
		// * The callback throws an error
		// Test:
		// * Ensure that we don't crash completely
		// * The call to child method throws an error due to the child closing
		// * A debug log is made to log the issue of being unable to return the thrown error in the callback to the child.

		const threaded = await threadedClass<TestClassEdgeCases, typeof TestClassEdgeCases>(TESTCLASS_PATH, 'TestClassEdgeCases', [], {})

		const onDestroyError = jest.fn((e) => {
			console.error('onDestroyError', e)
		})
		const onAfterDestroy = jest.fn()
		const onCallbackError = jest.fn()

		const callback = jest.fn(async () => {

			// Before this callback finishes, the child will die:
			await ThreadedClassManager.destroy(threaded).catch(onDestroyError)

			onAfterDestroy()

			// Now the child is dead, we throw from this callback.
			throw new Error('Here is the callback error')
		})

		await threaded.callCallback(callback).catch(onCallbackError)

		await sleep(10) // Ensure that all promises and callbacks have been resolved

		expect(callback).toHaveBeenCalledTimes(1)
		expect(onDestroyError).toHaveBeenCalledTimes(0)
		expect(onAfterDestroy).toHaveBeenCalledTimes(1)
		expect(onCallbackError).toHaveBeenCalledTimes(1)
		expect(onCallbackError.mock.calls[0][0].toString()).toMatch(/method.*aborted due to.*child.*closed/i)

		expect(onManagerDebugLogError).toHaveBeenCalledTimes(1)
		expect(onManagerDebugLogError.mock.calls[0][0].toString()).toMatch(/thrown error in callback.*unable to forward error.*due to.*process of instance.*has been closed/i)

		onManagerDebugLogError.mockClear()

	})
}
)
function sleep (ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms))
}
