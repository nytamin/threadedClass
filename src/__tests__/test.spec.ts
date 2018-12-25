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

const doPerformanceTests = false

const getTests = (disableMultithreading: boolean) => {
	return () => {

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

			let threaded = await threadedClass<House>(HOUSE_PATH, House, [['north', 'west'], ['south']], { disableMultithreading })
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

			let threaded = await threadedClass<TestClass>(TESTCLASS_PATH, TestClass, [], { disableMultithreading })
			let onClosed = jest.fn()
			ThreadedClassManager.onEvent(threaded, 'process_closed', onClosed)

			expect(await threaded.returnValue('asdf')).toEqual('asdf')

			await ThreadedClassManager.destroy(threaded)
			expect(ThreadedClassManager.getProcessCount()).toEqual(0)

			expect(onClosed).toHaveBeenCalledTimes(1)

		})
		test('eventEmitter', async () => {

			let threaded = await threadedClass<House>(HOUSE_PATH, House, [['north', 'west'], ['south']], { disableMultithreading })

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

			let threaded = await threadedClass<House>(HOUSE_PATH, House, [['north', 'west'], ['south']], { disableMultithreading })

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
			}], { disableMultithreading })
			expect(await threaded.host).toEqual('192.168.0.1')

			await ThreadedClassManager.destroy(threaded)
			expect(ThreadedClassManager.getProcessCount()).toEqual(0)
		})

		test('import native class', async () => {

			let original = new StringDecoder('utf8')

			// €-sign:
			let euroSign = original.end(Buffer.from([0xE2, 0x82, 0xAC]))
			expect(euroSign).toEqual('€')

			let threaded = await threadedClass<NodeStringDecoder>('string_decoder', StringDecoder, ['utf8'], { disableMultithreading })

			let euroSign2 = await threaded.end(Buffer.from([0xE2, 0x82, 0xAC]))

			expect(euroSign2).toEqual(euroSign)

			await ThreadedClassManager.destroy(threaded)

			expect(ThreadedClassManager.getProcessCount()).toEqual(0)
		})
		if (doPerformanceTests) {
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
						threadedClass<House>(HOUSE_PATH, House, [['aa', 'bb'], []], { disableMultithreading })
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
		}
		test('properties', async () => {
			let original = new House([], ['south'])
			let threaded = await threadedClass<House>(HOUSE_PATH, House, [[], ['south']], { disableMultithreading })

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
			let threadedHouse0 = await threadedClass<House>(HOUSE_PATH, House, [['south0'], []], { processUsage: 0.3, disableMultithreading })
			expect(ThreadedClassManager.getProcessCount()).toEqual(1)
			let threadedHouse1 = await threadedClass<House>(HOUSE_PATH, House, [['south1'], []], { processUsage: 0.3, disableMultithreading })
			expect(ThreadedClassManager.getProcessCount()).toEqual(1)
			let threadedHouse2 = await threadedClass<House>(HOUSE_PATH, House, [['south2'], []], { processUsage: 0.3, disableMultithreading })
			expect(ThreadedClassManager.getProcessCount()).toEqual(1)

			let threadedHouse3 = await threadedClass<House>(HOUSE_PATH, House, [['south3'], []], { processUsage: 0.3, disableMultithreading })
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
		test('fine-grained control of processes', async () => {

			expect(ThreadedClassManager.getProcessCount()).toEqual(0)

			// use processId to control which process the instances are put in
			let threadedHouse0 = await threadedClass<House>(HOUSE_PATH, House, [['south0'], []], { processId: 'one', disableMultithreading })
			expect(ThreadedClassManager.getProcessCount()).toEqual(1)
			let threadedHouse1 = await threadedClass<House>(HOUSE_PATH, House, [['south1'], []], { processId: 'one', disableMultithreading })
			expect(ThreadedClassManager.getProcessCount()).toEqual(1)
			let threadedHouse2 = await threadedClass<House>(HOUSE_PATH, House, [['south2'], []], { processId: 'one', disableMultithreading })
			expect(ThreadedClassManager.getProcessCount()).toEqual(1)

			let threadedHouse3 = await threadedClass<House>(HOUSE_PATH, House, [['south3'], []], { processId: 'two', disableMultithreading })
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

		test('supported data types', async () => {
			let threaded 	= await threadedClass<TestClass>(TESTCLASS_PATH, TestClass, [], { disableMultithreading })

			let values: any[] = [
				null,
				undefined,
				true,false, // boolean
				0,1,2,3, // number
				'','test', // string
				[1], [],[1,2,3],[null], // array
				{}, { a: 1 }, { a: 0 },
				(num0, num1) => num0 + num1 + 1,
				Buffer.from([1,2,3,4,4,5,6,7,8])
			]

			for (let value of values) {
				let returned: any = await threaded.returnValue(value)

				if (value && typeof value === 'function') {
					expect(typeof returned).toEqual('function')
					expect(await returned(40, 1)).toEqual(await value(40, 1))
				} else {
					expect(returned).toEqual(value)
				}
			}

			let o: any = {}
			o.parent = o
			let unsupportedValues = [
				o // circular dependency
			]
			for (let value of unsupportedValues) {
				let returnValue: any = null
				let returnError: any = null
				try {
					returnValue = await threaded.returnValue(value)
				} catch (e) {
					returnError = e
				}
				expect(returnError).toBeTruthy()
				expect(returnError.toString()).toMatch(/Unsupported/)
			}

			await ThreadedClassManager.destroy(threaded)
			expect(ThreadedClassManager.getProcessCount()).toEqual(0)

		})
		test('functions as arguments', async () => {
			let threaded 	= await threadedClass<TestClass>(TESTCLASS_PATH, TestClass, [], { disableMultithreading })

			let i = 0
			const calledSecond = jest.fn((a,b) => {
				expect(a).toEqual(3)
				expect(b).toEqual(4)

				expect(i++).toEqual(3)

				return 42
			})
			const calledFirst = jest.fn(async (a,b,c) => {
				expect(a).toEqual(1)
				expect(b).toEqual(2)
				expect(c).toEqual(3)
				expect(i++).toEqual(1)

				// return calledSecond
				return threaded.callFunction((a, b) => {
					expect(a).toEqual(6)
					expect(b).toEqual(7)
					expect(i++).toEqual(2)

					return calledSecond
				}, 6,7)
			})

			expect(i++).toEqual(0)
			const f0: any = await threaded.callFunction(calledFirst, 1, 2, 3)
			expect(calledFirst).toHaveBeenCalledTimes(1)

			expect(
				await f0(3,4) // will cause calledSecond to be called
			).toEqual(42)

			expect(calledSecond).toHaveBeenCalledTimes(1)

			/*
				What happened in detail:
				* threaded.callFunction was executed on parent
					* TestFunction.callFunction was executed on worker
						* calledFirst was executed on parent
							* TestFunction.callFunction was executed on worker
								* unnamed arrow function was executed on parent
									-> returns a reference to calledSecond
				v ------------------
				-> returns the reference to calledSecond

				* f0 was executed
			*/
		})

		test('error handling', async () => {
			let threaded 	= await threadedClass<TestClass>(TESTCLASS_PATH, TestClass, [], { disableMultithreading })

			let error: any = null

			try {
				await threaded.throwError()
			} catch (e) {
				error = e
			}
			expect(error.toString()).toMatch(/Error thrown/)
			error = null
			try {
				await threaded.throwErrorString()
			} catch (e) {
				error = e
			}
			expect(error.toString()).toMatch(/Error string thrown/)

			error = null
			try {
				await threaded.callFunction(() => {
					throw new Error('Error thrown in callback')
				})
			} catch (e) {
				error = e
			}
			expect(error.toString()).toMatch(/Error thrown in callback/)

			error = null
			const secondaryFunction = () => {
				throw new Error('Error thrown in secondary')
			}
			try {
				let second: any = await threaded.callFunction(() => {
					return secondaryFunction
				})
				await second('second')
			} catch (e) {
				error = e
			}
			expect(error && error.toString()).toMatch(/Error thrown in secondary/)

		})
	}
}

describe('threadedclass', getTests(false))
describe('threadedclass single thread', getTests(true))
