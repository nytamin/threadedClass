import {
	threadedClass,
	ThreadedClassManager
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
		expect(ThreadedClassManager.getThreadCount()).toEqual(0)
	})
	afterEach(async () => {
		await ThreadedClassManager.destroyAll()
		expect(ThreadedClassManager.getThreadCount()).toEqual(0)
	})
	test('restart instance', async () => {
		let threaded = await threadedClass<TestClass>(TESTCLASS_PATH, TestClass, [])
		let onClosed = jest.fn(() => {
			// oh dear, the process was closed
		})
		ThreadedClassManager.onEvent(threaded, 'thread_closed', onClosed)

		await threaded.exitProcess(10)
		await wait(100)
		expect(onClosed).toHaveBeenCalledTimes(1)
		await expect(threaded.returnValue('asdf')).rejects.toMatch(/closed/)

		await ThreadedClassManager.restart(threaded)

		expect(await threaded.returnValue('asdf')).toEqual('asdf')

		await ThreadedClassManager.destroy(threaded)
		expect(ThreadedClassManager.getThreadCount()).toEqual(0)

		expect(onClosed).toHaveBeenCalledTimes(2)

	})
	test('restart instance with multiple', async () => {
		let threaded0 	= await threadedClass<TestClass>(TESTCLASS_PATH, TestClass, [], { threadUsage: 0.1 })
		let threaded1 	= await threadedClass<TestClass>(TESTCLASS_PATH, TestClass, [], { threadUsage: 0.1 })
		let threaded2 	= await threadedClass<TestClass>(TESTCLASS_PATH, TestClass, [], { threadUsage: 0.1 })
		let onClosed0 = jest.fn()
		let onClosed1 = jest.fn()
		let onClosed2 = jest.fn()
		ThreadedClassManager.onEvent(threaded0, 'thread_closed', onClosed0)
		ThreadedClassManager.onEvent(threaded1, 'thread_closed', onClosed1)
		ThreadedClassManager.onEvent(threaded2, 'thread_closed', onClosed2)

		await threaded1.exitProcess(10)
		await wait(100)

		expect(onClosed0).toHaveBeenCalledTimes(1)
		expect(onClosed1).toHaveBeenCalledTimes(1)
		expect(onClosed2).toHaveBeenCalledTimes(1)
		await expect(threaded0.returnValue('asdf')).rejects.toMatch(/closed/)
		await expect(threaded1.returnValue('asdf')).rejects.toMatch(/closed/)
		await expect(threaded2.returnValue('asdf')).rejects.toMatch(/closed/)
		await ThreadedClassManager.restart(threaded2)
		await ThreadedClassManager.restart(threaded0)

		expect(ThreadedClassManager.getThreadCount()).toEqual(1)

		expect(await threaded0.returnValue('asdf')).toEqual('asdf')
		expect(await threaded2.returnValue('asdf')).toEqual('asdf')

		await expect(threaded1.returnValue('asdf')).rejects.toMatch(/not initialized/)
		await ThreadedClassManager.restart(threaded1)
		expect(await threaded1.returnValue('asdf')).toEqual('asdf')

		expect(ThreadedClassManager.getThreadCount()).toEqual(1)

		await ThreadedClassManager.destroy(threaded0)
		await ThreadedClassManager.destroy(threaded1)
		expect(ThreadedClassManager.getThreadCount()).toEqual(1)
		await ThreadedClassManager.destroy(threaded2)
		expect(ThreadedClassManager.getThreadCount()).toEqual(0)

		expect(onClosed0).toHaveBeenCalledTimes(1)
		expect(onClosed1).toHaveBeenCalledTimes(1)
		expect(onClosed2).toHaveBeenCalledTimes(2)

	})
	test('force restart', async () => {
		expect(ThreadedClassManager.getThreadCount()).toEqual(0)

		let thread0 = await threadedClass<House>(HOUSE_PATH, House, [['south0'], []])
		let onClosed = jest.fn()
		ThreadedClassManager.onEvent(thread0, 'thread_closed', onClosed)

		await thread0.setWindows(['north'])
		expect(await thread0.getWindows('')).toEqual(['north'])
		expect(ThreadedClassManager.getThreadCount()).toEqual(1)

		await ThreadedClassManager.restart(thread0)
		expect(onClosed).toHaveBeenCalledTimes(0)
		expect(await thread0.getWindows('')).toEqual(['south0'])
		await thread0.setWindows(['north'])
		expect(await thread0.getWindows('')).toEqual(['north'])

		// Force restart:
		await ThreadedClassManager.restart(thread0, true)
		expect(onClosed).toHaveBeenCalledTimes(1)
		expect(await thread0.getWindows('')).toEqual(['south0'])
		await thread0.setWindows(['north'])
		expect(await thread0.getWindows('')).toEqual(['north'])

		await ThreadedClassManager.destroyAll()
	})

	test('child process crash', async () => {
		expect(ThreadedClassManager.getThreadCount()).toEqual(0)

		let thread0 = await threadedClass<TestClass>(TESTCLASS_PATH, TestClass, [])
		let onClosed = jest.fn()
		ThreadedClassManager.onEvent(thread0, 'thread_closed', onClosed)

		expect(await thread0.waitReply(200, 'test')).toEqual('test')

		const p0 = thread0.waitReply(200, 'test2')
		.catch(err => { throw err.toString() })
		const p1 = thread0.exitProcess(0) // will cause the child process to crash
		.catch(err => { throw err.toString() })

		await expect(p0).rejects.toMatch(/closed/i)
		await expect(p1).rejects.toMatch(/closed/i)

		await expect(
			thread0.waitReply(200, 'test3')
			.catch(err => { throw err.toString() })
		).rejects.toMatch(/closed/)

		await ThreadedClassManager.destroyAll()
	})
	test('automatic restart', async () => {
		expect(ThreadedClassManager.getThreadCount()).toEqual(0)

		let thread0 = await threadedClass<House>(HOUSE_PATH, House, [['south0'], []],{
			autoRestart: true,
			threadUsage: 0.5
		})
		let thread1 = await threadedClass<TestClass>(TESTCLASS_PATH, TestClass, [],{
			autoRestart: true,
			threadUsage: 0.5
		})
		let onClosed = jest.fn()
		let onRestarted = jest.fn()
		ThreadedClassManager.onEvent(thread0, 'thread_closed', onClosed)
		ThreadedClassManager.onEvent(thread0, 'restarted', onRestarted)

		let restarted0 = new Promise((resolved) => {
			ThreadedClassManager.onEvent(thread0, 'restarted', resolved)
		})
		let restarted1 = new Promise((resolved) => {
			ThreadedClassManager.onEvent(thread1, 'restarted', resolved)
		})

		await thread0.setWindows(['north'])
		expect(await thread0.getWindows('')).toEqual(['north'])
		expect(ThreadedClassManager.getThreadCount()).toEqual(1)

		const p0 = thread1.waitReply(200, 'test2')
		.catch(err => { throw err.toString() })
		const p1 = thread1.exitProcess(0) // will cause the child to crash
		.catch(err => { throw err.toString() })

		await expect(p0).rejects.toMatch(/closed/i)
		await expect(p1).rejects.toMatch(/closed/i)

		// The process should now automatically restart
		await restarted0
		await restarted1

		restarted0 = new Promise((resolved) => {
			ThreadedClassManager.onEvent(thread0, 'restarted', resolved)
		})
		restarted1 = new Promise((resolved) => {
			ThreadedClassManager.onEvent(thread1, 'restarted', resolved)
		})

		expect(await thread0.getWindows('')).toEqual(['south0']) // because the instance has been restarted, it is reset

		const p2 = thread1.waitReply(200, 'test2')
		.catch(err => { throw err.toString() })
		const p3 = thread1.freeze() // will cause the child to freeze
		.catch(err => { throw err.toString() })

		await expect(p2).rejects.toMatch(/timeout/i)
		await expect(p3).rejects.toMatch(/timeout/i)

		// The process should now automatically restart
		await restarted0
		await restarted1

		expect(await thread0.getWindows('')).toEqual(['south0']) // because the instance has been restarted, it is reset

		await ThreadedClassManager.destroyAll()
	})

	test('orphan monitoring', async () => {
		expect(ThreadedClassManager.getThreadCount()).toEqual(0)

		let thread1 = await threadedClass<TestClass>(TESTCLASS_PATH, TestClass, [],{
			autoRestart: true,
			threadUsage: 0.5,
			freezeLimit: 200
		})

		let restarted1 = new Promise((resolved) => {
			ThreadedClassManager.onEvent(thread1, 'restarted', resolved)
		})
		expect(ThreadedClassManager.getThreadCount()).toEqual(1)

		// Stop pinging the child:
		// @ts-ignore
		let internal: any = ThreadedClassManager._internal
		internal._pinging = false

		// await wait(1000)

		// expect the process to detect that it's been orphaned
		// child process should close and be restarted:
		await restarted1
		internal._pinging = true

		expect(await thread1.waitReply(200, 'test4')).toEqual('test4')

		await ThreadedClassManager.destroyAll()
	})

	test('unknown instance', async () => {
		let otherInstance = {}
		await expect(
			ThreadedClassManager.destroy(otherInstance)
		).rejects.toMatch(/Proxy not found/)

		await expect(
			ThreadedClassManager.restart(otherInstance)
			.catch(e => Promise.reject(e.toString()))
		).rejects.toMatch(/Child of proxy not found/)
	})
})
