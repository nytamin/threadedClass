jest.mock('casparcg-connection')
import { threadedClass, ThreadedClassManager } from '..'
import { TestClass2 } from '../../test-lib/testClass2'
import { RegisterExitHandlers } from '../parent-process/manager'
const TESTCLASS_PATH = '../../test-lib/testClass2.js'

describe('Test with Jest mock', () => {
	beforeAll(() => {
		ThreadedClassManager.handleExit = RegisterExitHandlers.No
		ThreadedClassManager.debug = false
	})

	test('mock', async () => {

		// This test is making sure jest is mocking modules that are used inside the threaded class.

		for (const disableMultithreading of [true, false]) {

			let original = new TestClass2()
			expect(original.isOkay()).toEqual(true)

			let threaded = await threadedClass<TestClass2, typeof TestClass2>(TESTCLASS_PATH, 'TestClass2', [], { disableMultithreading })
			let onClosed = jest.fn()
			ThreadedClassManager.onEvent(threaded, 'thread_closed', onClosed)

			expect(await threaded.isOkay()).toEqual(true)

			await ThreadedClassManager.destroy(threaded)
			expect(ThreadedClassManager.getThreadCount()).toEqual(0)

			expect(onClosed).toHaveBeenCalledTimes(1)
		}

	})
})
