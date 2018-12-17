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
describe('threadedclass', () => {

	beforeEach(async () => {
		await ThreadedClassManager.destroyAll()
		expect(ThreadedClassManager.getProcessCount()).toEqual(0)
	})
	afterEach(async () => {
		await ThreadedClassManager.destroyAll()
		expect(ThreadedClassManager.getProcessCount()).toEqual(0)
	})
	test('import own class', async () => {

		let original = new House(['north', 'west'], ['south'])

		expect(original.getWindows('')).toHaveLength(2)
		expect(original.getRooms()).toHaveLength(1)

		let threaded = await threadedClass<House>(HOUSE_PATH, House, [['north', 'west'], ['south']])
		let onClosed = jest.fn()
		ThreadedClassManager.onEvent(threaded, 'process_closed', onClosed)

		expect(await threaded.getWindows('')).toHaveLength(2)
		expect(await threaded.getRooms()).toHaveLength(1)

		await ThreadedClassManager.destroy(threaded)
		expect(ThreadedClassManager.getProcessCount()).toEqual(0)

		expect(onClosed).toHaveBeenCalledTimes(1)
	})
	test('import own basic class', async () => {
		let original = new TestClass()

		expect(original.returnValue('asdf')).toEqual('asdf')

		let threaded = await threadedClass<TestClass>(TESTCLASS_PATH, TestClass, [])
		let onClosed = jest.fn()
		ThreadedClassManager.onEvent(threaded, 'process_closed', onClosed)

		expect(await threaded.returnValue('asdf')).toEqual('asdf')

		await ThreadedClassManager.destroy(threaded)
		expect(ThreadedClassManager.getProcessCount()).toEqual(0)

		expect(onClosed).toHaveBeenCalledTimes(1)

	})
	test('eventEmitter', async () => {

		let threaded = await threadedClass<House>(HOUSE_PATH, House, [['north', 'west'], ['south']])

		let onEvent = jest.fn()
		await threaded.on('test', onEvent)

		await threaded.doEmit('test')

		await new Promise((resolve) => { setTimeout(resolve, 200) })
		expect(onEvent).toHaveBeenCalledTimes(1)

		await ThreadedClassManager.destroy(threaded)
		expect(ThreadedClassManager.getProcessCount()).toEqual(0)
	})

	test('method with callback', async () => {

		let original = new House(['north', 'west'], ['south'])

		let result = await original.callCallback('parent', (str) => {
			return Promise.resolve(str + ',parent2')
		})

		expect(result).toEqual('parent,child,parent2,child2')

		let threaded = await threadedClass<House>(HOUSE_PATH, House, [['north', 'west'], ['south']])

		let onEvent = jest.fn()
		await threaded.on('test', onEvent)

		result = await threaded.callCallback('parent', (str) => {
			return str + ',parent2'
		})

		// await new Promise((resolve) => { setTimeout(resolve, 200) })
		expect(result).toEqual('parent,child,parent2,child2')

		await ThreadedClassManager.destroy(threaded)
		expect(ThreadedClassManager.getProcessCount()).toEqual(0)
	})

	test('import library class', async () => {

		let original = new CasparCG({
			host: '192.168.0.1',
			autoConnect: false
		})
		expect(original.host).toEqual('192.168.0.1')

		let threaded = await threadedClass<CasparCG>('casparcg-connection', CasparCG, [{
			host: '192.168.0.1',
			autoConnect: false
		}])
		expect(await threaded.host).toEqual('192.168.0.1')

		await ThreadedClassManager.destroy(threaded)
		expect(ThreadedClassManager.getProcessCount()).toEqual(0)
	})

	test('import native class', async () => {

		let original = new StringDecoder('utf8')

		// €-sign:
		let euroSign = original.end(Buffer.from([0xE2, 0x82, 0xAC]))
		expect(euroSign).toEqual('€')

		let threaded = await threadedClass<NodeStringDecoder>('string_decoder', StringDecoder, ['utf8'])

		let euroSign2 = await threaded.end(Buffer.from([0xE2, 0x82, 0xAC]))

		expect(euroSign2).toEqual(euroSign)

		await ThreadedClassManager.destroy(threaded)

		expect(ThreadedClassManager.getProcessCount()).toEqual(0)
	})

	test('single-thread', async () => {
		// let startTime = Date.now()
		let results: Array<number> = []
		for (let i = 0; i < 5; i++) {

			let myHouse = new House(['aa', 'bb'], [])

			results.push(myHouse.slowFib(37))
		}
		// let endTime = Date.now()

		// console.log('Single-thread: ', results.length, endTime - startTime)
		expect(results).toHaveLength(5)
	})

	test('multi-thread', async () => {
		// let startTime = Date.now()
		let threads: ThreadedClass<House>[] = []
		let results: Array<number> = []

		let ps: any = []

		for (let i = 0; i < 5; i++) {
			ps.push(
				threadedClass<House>(HOUSE_PATH, House, [['aa', 'bb'], []])
				.then((myHouse) => {
					threads.push(myHouse)
					return myHouse.slowFib(37)
				})
				.then((result) => {
					results.push(result[1])
				})
			)
		}
		await Promise.all(ps)
		// let endTime = Date.now()
		await Promise.all(threads.map((thread) => {
			return ThreadedClassManager.destroy(thread)
		}))

		// console.log('Multi-thread: ', results.length, endTime - startTime)
		expect(results).toHaveLength(5)
		expect(ThreadedClassManager.getProcessCount()).toEqual(0)
	})

	test('properties', async () => {
		let original = new House([], ['south'])
		let threaded = await threadedClass<House>(HOUSE_PATH, House, [[], ['south']])

		// Method with parameter and return value:
		expect(original.returnValue('myValue')).toEqual('myValue')
		//
		expect(await threaded.returnValue('myValue')).toEqual('myValue')

		// Method to set and get value:
		original.setWindows(['west', 'south'])
		expect(original.getWindows('')).toHaveLength(2)
		//
		await threaded.setWindows(['west', 'south'])
		expect(await threaded.getWindows('')).toHaveLength(2)

		// Public property:
		original.windows = ['a','b','c','d']
		expect(original.windows).toEqual(['a','b','c','d'])
		//
		// @ts-ignore this technically works, though the typings do not:
		threaded.windows = ['a','b','c','d']
		expect(await threaded.windows).toEqual(['a','b','c','d'])

		// Method to get private property:
		expect(original.getRooms()).toHaveLength(1)
		//
		expect(await threaded.getRooms()).toHaveLength(1)

		// Getter to get private property:
		expect(original.getterRooms).toHaveLength(1)
		//
		expect(await threaded.getterRooms).toHaveLength(1)

		// Private property that has both a getter and a setter:
		original.lamps = 91
		expect(original.lamps).toEqual(91)
		//
		// @ts-ignore this technically works, though the typings do not:
		threaded.lamps = 91
		expect(await threaded.lamps).toEqual(91)

		// Private property that only has getter:
		expect(original.readonly).toEqual(42)
		// original.readonly = 3 // not allowed according to types (which is correct)
		//
		expect(await threaded.readonly).toEqual(42)

		// Private property that only has setter:
		original.writeonly = 13
		expect(original.writeonly).toEqual(undefined)
		//
		// @ts-ignore this technically works, though the typings do not:
		threaded.writeonly = 13
		await expect(threaded.writeonly).rejects.toMatch(/not found/i) // Function "writeonly" not found

		await ThreadedClassManager.destroy(threaded)
		expect(ThreadedClassManager.getProcessCount()).toEqual(0)
	})

	test('multiple instances in same process', async () => {

		expect(ThreadedClassManager.getProcessCount()).toEqual(0)

		// processUsage: 0.3, make room for 3 instances in each process
		let threadedHouse0 = await threadedClass<House>(HOUSE_PATH, House, [['south0'], []], { processUsage: 0.3 })
		expect(ThreadedClassManager.getProcessCount()).toEqual(1)
		let threadedHouse1 = await threadedClass<House>(HOUSE_PATH, House, [['south1'], []], { processUsage: 0.3 })
		expect(ThreadedClassManager.getProcessCount()).toEqual(1)
		let threadedHouse2 = await threadedClass<House>(HOUSE_PATH, House, [['south2'], []], { processUsage: 0.3 })
		expect(ThreadedClassManager.getProcessCount()).toEqual(1)

		let threadedHouse3 = await threadedClass<House>(HOUSE_PATH, House, [['south3'], []], { processUsage: 0.3 })
		expect(ThreadedClassManager.getProcessCount()).toEqual(2)

		// Check that all instances return correct data:
		let windows = await Promise.all([
			threadedHouse0.getWindows('0'),
			threadedHouse1.getWindows('1'),
			threadedHouse2.getWindows('2'),
			threadedHouse3.getWindows('3')
		])

		expect(windows[0]).toEqual(['0', 'south0'])
		expect(windows[1]).toEqual(['1', 'south1'])
		expect(windows[2]).toEqual(['2', 'south2'])
		expect(windows[3]).toEqual(['3', 'south3'])

		// Clean up
		await ThreadedClassManager.destroy(threadedHouse0)
		expect(ThreadedClassManager.getProcessCount()).toEqual(2)
		await ThreadedClassManager.destroy(threadedHouse1)
		expect(ThreadedClassManager.getProcessCount()).toEqual(2)
		await ThreadedClassManager.destroy(threadedHouse2)
		expect(ThreadedClassManager.getProcessCount()).toEqual(1)
		await ThreadedClassManager.destroy(threadedHouse3)
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
