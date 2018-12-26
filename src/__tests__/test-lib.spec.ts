import { House as HouseTS } from '../../test-lib/house'
import { House as HouseJS } from '../../test-lib/house.js'
import { TestClass as TestClassTS } from '../../test-lib/testClass'
import { TestClass as TestClassJS } from '../../test-lib/testClass.js'

describe('test-lib', () => {

	let orgProcessExit: Function
	const mockExit = jest.fn()

	beforeAll(() => {
		orgProcessExit = process.exit
		// @ts-ignore
		process.exit = mockExit
	})
	afterAll(() => {
		// @ts-ignore
		process.exit = orgProcessExit
	})
	test('House', async () => {
		let houses = [
			new HouseTS(['window0', 'window1', 'window2'], ['room0', 'room1']),
			new HouseJS(['window0', 'window1', 'window2'], ['room0', 'room1'])
		]
		for (let house of houses) {

			const onEvent = jest.fn()
			house.on('evt', onEvent)

			expect(house.returnValue(12)).toEqual(12)
			expect(house.getWindows('aa')).toEqual(['aa', 'window0', 'window1', 'window2'])
			expect(house.getWindows('')).toEqual(['window0', 'window1', 'window2'])
			house.setWindows(['window0', 'window1'])
			expect(house.getWindows('bb')).toEqual(['bb', 'window0', 'window1'])
			expect(house.getRooms()).toEqual(['room0', 'room1'])
			expect(house.getterRooms).toEqual(['room0', 'room1'])
			house.lamps = 15
			expect(house.lamps).toEqual(15)
			expect(house.readonly).toEqual(42)
			house.writeonly = 32
			expect(house.slowFib(6)).toEqual(8)

			expect(onEvent).toHaveBeenCalledTimes(0)
			house.doEmit('evt')
			expect(onEvent).toHaveBeenCalledTimes(1)
			const cb = jest.fn((name: string) => {
				return Promise.resolve('cb' + name)
			})
			let result = await house.callCallback('a', cb)
			expect(cb).toHaveBeenCalledTimes(1)
			expect(result).toEqual('cba,child,child2')

			await expect(
				house.callCallback('a', (_name: string) => {
					return Promise.reject('nope')
				})
			).rejects.toMatch(/nope/)
		}

	})

	test('TestClass', async () => {
		let testClasses = [
			new TestClassTS(),
			new TestClassJS()
		]
		for (let testClass of testClasses) {
			mockExit.mockClear()

			expect(testClass.returnValue('123')).toEqual('123')
			const cb = jest.fn((name: string, name2: string) => {
				return 'cb' + name + name2
			})
			expect(testClass.callFunction(cb, 'a', 'b')).toEqual('cbab')
			expect(() => {
				testClass.throwError()
			}).toThrowError()
			expect(() => {
				testClass.throwErrorString()
			}).toThrowError()

			testClass.exitProcess(0)
			expect(mockExit).toHaveBeenCalledTimes(1)

			testClass.exitProcess(20)
			await wait(30)
			expect(mockExit).toHaveBeenCalledTimes(2)

			let mockLog = jest.fn()
			let orgConsoleLog = console.log
			console.log = mockLog

			testClass.logSomething('aa', 'bb')

			console.log = orgConsoleLog

			expect(mockLog).toHaveBeenCalledTimes(1)
			expect(mockLog.mock.calls[0]).toEqual(['aa', 'bb'])
		}
	})
	function wait (time: number) {
		return new Promise((resolve) => {
			setTimeout(resolve, time)
		})
	}
})
