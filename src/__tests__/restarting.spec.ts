import { StringDecoder, NodeStringDecoder } from 'string_decoder'
import { CasparCG } from 'casparcg-connection'
import {
	threadedClass,
	ThreadedClassManager,
	ThreadedClass
} from '../index'
import { House } from '../../test-lib/house'
import { TestClass } from '../../test-lib/testClass'

const HOUSE_PATH = '../../test-lib/house.js'
const TESTCLASS_PATH = '../../test-lib/testClass.js'

function wait (time: number) {
	return new Promise((resolve) => {
		setTimeout(resolve, time)
	})
}

describe('restarts', () => {

	beforeEach(async () => {
		await ThreadedClassManager.destroyAll()
		expect(ThreadedClassManager.getProcessCount()).toEqual(0)
	})
	afterEach(async () => {
		await ThreadedClassManager.destroyAll()
		expect(ThreadedClassManager.getProcessCount()).toEqual(0)
	})
	test('restart instance', async () => {
		let threaded = await threadedClass<TestClass>(TESTCLASS_PATH, TestClass, [])
		let onClosed = jest.fn(() => {
			// oh dear, the process was closed
		})
		ThreadedClassManager.onEvent(threaded, 'process_closed', onClosed)

		await threaded.exitProcess(10)
		await wait(100)
		expect(onClosed).toHaveBeenCalledTimes(1)
		await expect(threaded.returnValue('asdf')).rejects.toMatch(/closed/)

		ThreadedClassManager.restart(threaded)

		expect(await threaded.returnValue('asdf')).toEqual('asdf')

		await ThreadedClassManager.destroy(threaded)
		expect(ThreadedClassManager.getProcessCount()).toEqual(0)

		expect(onClosed).toHaveBeenCalledTimes(2)

	})
	test('restart instance with multiple', async () => {
		let threaded0 	= await threadedClass<TestClass>(TESTCLASS_PATH, TestClass, [], { processUsage: 0.1 })
		let threaded1 	= await threadedClass<TestClass>(TESTCLASS_PATH, TestClass, [], { processUsage: 0.1 })
		let threaded2 	= await threadedClass<TestClass>(TESTCLASS_PATH, TestClass, [], { processUsage: 0.1 })
		let onClosed0 = jest.fn()
		let onClosed1 = jest.fn()
		let onClosed2 = jest.fn()
		ThreadedClassManager.onEvent(threaded0, 'process_closed', onClosed0)
		ThreadedClassManager.onEvent(threaded1, 'process_closed', onClosed1)
		ThreadedClassManager.onEvent(threaded2, 'process_closed', onClosed2)

		await threaded1.exitProcess(10)
		await wait(100)

		expect(onClosed0).toHaveBeenCalledTimes(1)
		expect(onClosed1).toHaveBeenCalledTimes(1)
		expect(onClosed2).toHaveBeenCalledTimes(1)
		await expect(threaded0.returnValue('asdf')).rejects.toMatch(/closed/)
		await expect(threaded1.returnValue('asdf')).rejects.toMatch(/closed/)
		await expect(threaded2.returnValue('asdf')).rejects.toMatch(/closed/)
		ThreadedClassManager.restart(threaded2)
		ThreadedClassManager.restart(threaded0)

		expect(ThreadedClassManager.getProcessCount()).toEqual(1)

		expect(await threaded0.returnValue('asdf')).toEqual('asdf')
		expect(await threaded2.returnValue('asdf')).toEqual('asdf')

		await expect(threaded1.returnValue('asdf')).rejects.toMatch(/not initialized/)
		ThreadedClassManager.restart(threaded1)
		expect(await threaded1.returnValue('asdf')).toEqual('asdf')

		expect(ThreadedClassManager.getProcessCount()).toEqual(1)

		await ThreadedClassManager.destroy(threaded0)
		await ThreadedClassManager.destroy(threaded1)
		expect(ThreadedClassManager.getProcessCount()).toEqual(1)
		await ThreadedClassManager.destroy(threaded2)
		expect(ThreadedClassManager.getProcessCount()).toEqual(0)

		expect(onClosed0).toHaveBeenCalledTimes(1)
		expect(onClosed1).toHaveBeenCalledTimes(1)
		expect(onClosed2).toHaveBeenCalledTimes(2)

	})
})