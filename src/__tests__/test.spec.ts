import { StringDecoder, NodeStringDecoder } from 'string_decoder'
import { CasparCG } from 'casparcg-connection'
import {
	threadedClass,
	ThreadedClassManager,
	ThreadedClass
} from '../index'
import { House } from '../../test-lib/house'
import { TestClass } from '../../test-lib/testClass'
import { ThreadMode } from '../manager'

const HOUSE_PATH = '../../test-lib/house.js'
const TESTCLASS_PATH = '../../test-lib/testClass.js'
const TESTCLASS_PATH_UNSYNCED = '../../test-lib/testClass-unsynced.js'

// function wait (time: number) {
// 	return new Promise((resolve) => {
// 		setTimeout(resolve, time)
// 	})
// }

const doPerformanceTests = false

const getTests = (disableMultithreading: boolean) => {
	return () => {

		beforeEach(async () => {
			await ThreadedClassManager.destroyAll()
			expect(ThreadedClassManager.getThreadCount()).toEqual(0)
		})
		afterEach(async () => {
			await ThreadedClassManager.destroyAll()
			expect(ThreadedClassManager.getThreadCount()).toEqual(0)
		})
		test('import own class', async () => {

			let original = new House(['north', 'west'], ['south'])

			expect(original.getWindows('')).toHaveLength(2)
			expect(original.getRooms()).toHaveLength(1)

			let threaded = await threadedClass<House>(HOUSE_PATH, House, [['north', 'west'], ['south']], { disableMultithreading })
			let onClosed = jest.fn()
			const onClosedListener = ThreadedClassManager.onEvent(threaded, 'thread_closed', onClosed)

			expect(await threaded.getWindows('')).toHaveLength(2)
			expect(await threaded.getRooms()).toHaveLength(1)

			await ThreadedClassManager.destroy(threaded)
			expect(ThreadedClassManager.getThreadCount()).toEqual(0)

			onClosedListener.stop()

			expect(onClosed).toHaveBeenCalledTimes(1)
		})
		test('import own basic class', async () => {
			let original = new TestClass()

			expect(original.returnValue('asdf')).toEqual('asdf')

			let threaded = await threadedClass<TestClass>(TESTCLASS_PATH, TestClass, [], { disableMultithreading })
			let onClosed = jest.fn()
			ThreadedClassManager.onEvent(threaded, 'thread_closed', onClosed)

			expect(await threaded.returnValue('asdf')).toEqual('asdf')

			await ThreadedClassManager.destroy(threaded)
			expect(ThreadedClassManager.getThreadCount()).toEqual(0)

			expect(onClosed).toHaveBeenCalledTimes(1)

		})
		test('import wrong path', async () => {
			let error: any = null
			try {
				await threadedClass<House>('./nonexistent/path', House, [[], []], { disableMultithreading })
			} catch (e) {
				error = e.toString()
			}
			expect(error).toMatch(/Cannot find module/)

		})
		test('eventEmitter', async () => {

			let threaded = await threadedClass<House>(HOUSE_PATH, House, [['north', 'west'], ['south']], { disableMultithreading })

			let onEvent = jest.fn()
			await threaded.on('test', onEvent)

			await threaded.doEmit('test')

			await new Promise((resolve) => { setTimeout(resolve, 200) })
			expect(onEvent).toHaveBeenCalledTimes(1)

			await ThreadedClassManager.destroy(threaded)
			expect(ThreadedClassManager.getThreadCount()).toEqual(0)
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

			result = await threaded.callCallback('parent', (str: any) => {
				return str + ',parent2'
			})

			// await new Promise((resolve) => { setTimeout(resolve, 200) })
			expect(result).toEqual('parent,child,parent2,child2')

			await ThreadedClassManager.destroy(threaded)
			expect(ThreadedClassManager.getThreadCount()).toEqual(0)
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
			expect(ThreadedClassManager.getThreadCount()).toEqual(0)
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

			expect(ThreadedClassManager.getThreadCount()).toEqual(0)
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
							results.push(result)
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
				expect(ThreadedClassManager.getThreadCount()).toEqual(0)
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
			expect(await threaded.writeonly).toEqual(undefined)

			await ThreadedClassManager.destroy(threaded)
			expect(ThreadedClassManager.getThreadCount()).toEqual(0)
		})

		test('multiple instances in same thread', async () => {

			expect(ThreadedClassManager.getThreadCount()).toEqual(0)

			// threadUsage: 0.3, make room for 3 instances in each thread
			let threadedHouse0 = await threadedClass<House>(HOUSE_PATH, House, [['south0'], []], { threadUsage: 0.3, disableMultithreading })
			expect(ThreadedClassManager.getThreadCount()).toEqual(1)
			let threadedHouse1 = await threadedClass<House>(HOUSE_PATH, House, [['south1'], []], { threadUsage: 0.3, disableMultithreading })
			expect(ThreadedClassManager.getThreadCount()).toEqual(1)
			let threadedHouse2 = await threadedClass<House>(HOUSE_PATH, House, [['south2'], []], { threadUsage: 0.3, disableMultithreading })
			expect(ThreadedClassManager.getThreadCount()).toEqual(1)

			let threadedHouse3 = await threadedClass<House>(HOUSE_PATH, House, [['south3'], []], { threadUsage: 0.3, disableMultithreading })
			expect(ThreadedClassManager.getThreadCount()).toEqual(2)

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
			expect(ThreadedClassManager.getThreadCount()).toEqual(2)
			await ThreadedClassManager.destroy(threadedHouse1)
			expect(ThreadedClassManager.getThreadCount()).toEqual(2)
			await ThreadedClassManager.destroy(threadedHouse2)
			expect(ThreadedClassManager.getThreadCount()).toEqual(1)
			await ThreadedClassManager.destroy(threadedHouse3)
			expect(ThreadedClassManager.getThreadCount()).toEqual(0)

		})
		test('fine-grained control of threads', async () => {

			expect(ThreadedClassManager.getThreadCount()).toEqual(0)

			// use threadId to control which thread the instances are put in
			let threadedHouse0 = await threadedClass<House>(HOUSE_PATH, House, [['south0'], []], { threadId: 'one', disableMultithreading })
			expect(ThreadedClassManager.getThreadCount()).toEqual(1)
			let threadedHouse1 = await threadedClass<House>(HOUSE_PATH, House, [['south1'], []], { threadId: 'one', disableMultithreading })
			expect(ThreadedClassManager.getThreadCount()).toEqual(1)
			let threadedHouse2 = await threadedClass<House>(HOUSE_PATH, House, [['south2'], []], { threadId: 'one', disableMultithreading })
			expect(ThreadedClassManager.getThreadCount()).toEqual(1)

			let threadedHouse3 = await threadedClass<House>(HOUSE_PATH, House, [['south3'], []], { threadId: 'two', disableMultithreading })
			expect(ThreadedClassManager.getThreadCount()).toEqual(2)

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
			expect(ThreadedClassManager.getThreadCount()).toEqual(2)
			await ThreadedClassManager.destroy(threadedHouse1)
			expect(ThreadedClassManager.getThreadCount()).toEqual(2)
			await ThreadedClassManager.destroy(threadedHouse2)
			expect(ThreadedClassManager.getThreadCount()).toEqual(1)
			await ThreadedClassManager.destroy(threadedHouse3)
			expect(ThreadedClassManager.getThreadCount()).toEqual(0)
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
				(num0: number, num1: number): number => num0 + num1 + 1,
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
				let returnError: any = null
				try {
					await threaded.returnValue(value)
				} catch (e) {
					returnError = e
				}
				if (disableMultithreading) {
					// When running in single-thread, allow circular objects
					expect(returnError).toBeNull()
				} else {
					if (ThreadedClassManager.getThreadMode() === ThreadMode.WORKER_THREADS) {
						// In Worker_threads, circular objects CAN be sent
						expect(returnError).toBeNull()
					} else {
						expect(returnError).toBeTruthy()
						expect((returnError.stack || returnError).toString()).toMatch(/unsupported attribute/i)
					}
				}
			}

			await ThreadedClassManager.destroy(threaded)
			expect(ThreadedClassManager.getThreadCount()).toEqual(0)

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
				return threaded.callFunction((a: number, b: number) => {
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
			try {
				await threaded.callFunction(() => {
					return Promise.reject('Reject in callback')
				})
			} catch (e) {
				error = e
			}
			expect(error.toString()).toMatch(/Reject in callback/)

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

			error = null
			const secondaryFunctionReject = () => {
				return Promise.reject('Reject in secondary')
			}
			try {
				let second: any = await threaded.callFunction(() => {
					return secondaryFunctionReject
				})
				await second('second')
			} catch (e) {
				error = e
			}
			expect(error && error.toString()).toMatch(/Reject in secondary/)

		})
		test('logging', async () => {
			let threaded 	= await threadedClass<TestClass>(TESTCLASS_PATH, TestClass, [], { disableMultithreading })

			let mockLog = jest.fn()
			let orgConsoleLog = console.log
			console.log = mockLog

			await threaded.logSomething('aa', 'bb')

			console.log = orgConsoleLog // restore

			expect(mockLog).toHaveBeenCalledTimes(1)
			if (disableMultithreading) {
				expect(mockLog.mock.calls[0]).toEqual(['aa', 'bb'])
			} else {
				expect(mockLog.mock.calls[0]).toEqual(['', 'aa', 'bb'])
			}
		})
		test('EventEmitter', async () => {
			let threaded 	= await threadedClass<TestClass>(TESTCLASS_PATH, TestClass, [], { disableMultithreading })

			const eventListener0 = jest.fn()
			const eventListener1 = jest.fn()
			await threaded.on('event0', eventListener0)
			await threaded.on('event1', eventListener1)

			await threaded.emitMessage('event0', 'a')
			await threaded.emitMessage('event1', 'b')

			expect(eventListener0).toHaveBeenCalledTimes(1)
			expect(eventListener0).toHaveBeenCalledWith('a')
			expect(eventListener1).toHaveBeenCalledTimes(1)
			expect(eventListener1).toHaveBeenCalledWith('b')

			let self = await threaded.getSelf()

			expect(self).toEqual(threaded)

		})
		test('import typescript', async () => {
			let threaded 	= await threadedClass<TestClass>(TESTCLASS_PATH_UNSYNCED, TestClass, [], { disableMultithreading })

			let id = await threaded.getId()

			if (disableMultithreading) {
				// expect the ts file to have been loaded:
				expect(id).toEqual('abc')
			} else {
				// expect the js file to have been loaded:
				expect(id).toEqual('unsynced')
			}

		})
		test('circular object', async () => {
			let original = new TestClass()

			expect(original.returnValue('asdf')).toEqual('asdf')

			let threaded = await threadedClass<TestClass>(TESTCLASS_PATH, TestClass, [], { disableMultithreading, instanceName: 'myInstance' })
			let onClosed = jest.fn()
			ThreadedClassManager.onEvent(threaded, 'thread_closed', onClosed)

			if (
				disableMultithreading || // circular objects should be supported when running in single thread
				ThreadedClassManager.getThreadMode() === ThreadMode.WORKER_THREADS // When using worker_threads, circular objects are allowed
			) {
				expect(await threaded.getCircular('asdf')).toMatchObject({
					a: 1,
					b: 2,
					val: 'asdf'
				})
			} else {
				let error: any = null
				try {
					await threaded.getCircular('asdf')
				} catch (e) {
					error = e
				}
				expect(error.toString()).toMatch(/circular/)
				expect(error.toString()).toMatch(/getCircular/)
				expect(error.toString()).toMatch(/myInstance/)
			}

			await ThreadedClassManager.destroy(threaded)
			expect(ThreadedClassManager.getThreadCount()).toEqual(0)

			expect(onClosed).toHaveBeenCalledTimes(1)
		})
	}
}

describe('threadedclass', getTests(false))
describe('threadedclass single thread', getTests(true))

// Test on behaviour that differ bewteen Multi-threading vs none
describe('single-thread tests', () => {
	const disableMultithreading = true
	test('Buffer', async () => {
		let original = new TestClass()

		let bugString = '123456789abcfdef'

		let buf = Buffer.from(bugString)
		let buf2 = buf
		let buf3 = Buffer.from(bugString)

		expect(buf === buf2).toEqual(true)
		expect(buf === buf3).toEqual(false)

		expect((original.returnValue(buf)) === buf2).toEqual(true)
		expect((original.returnValue(buf)) === buf3).toEqual(false)

		let singleThreaded = await threadedClass<TestClass>(TESTCLASS_PATH, TestClass, [], { disableMultithreading })
		let onClosed = jest.fn()
		ThreadedClassManager.onEvent(singleThreaded, 'thread_closed', onClosed)

		let multiThreaded = await threadedClass<TestClass>(TESTCLASS_PATH, TestClass, [], {})
		let onClosed2 = jest.fn()
		ThreadedClassManager.onEvent(multiThreaded, 'thread_closed', onClosed2)

		// Handle buffers correctly in single threaded mode
		expect((await singleThreaded.returnValue(buf)) === buf2).toEqual(true)
		expect((await singleThreaded.returnValue(buf)) === buf3).toEqual(false)

		// Not possible to handle buffers correctly in threaded mode
		expect((await multiThreaded.returnValue(buf)) === buf2).toEqual(false)
		expect((await multiThreaded.returnValue(buf)) === buf3).toEqual(false)
		// However the values of the buffers should be correct:
		expect((await multiThreaded.returnValue(buf)).toString() === buf2.toString()).toEqual(true)
		expect((await multiThreaded.returnValue(buf)).toString() === buf3.toString()).toEqual(true)

		await ThreadedClassManager.destroy(singleThreaded)
		await ThreadedClassManager.destroy(multiThreaded)
		expect(ThreadedClassManager.getThreadCount()).toEqual(0)

		expect(onClosed).toHaveBeenCalledTimes(1)
		expect(onClosed2).toHaveBeenCalledTimes(1)
	})
})
