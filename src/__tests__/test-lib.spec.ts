import { House } from '../../test-lib/house'
import { TestClass } from '../../test-lib/testClass'

describe('test-lib', () => {

	let orgProcessExit: Function
	let mockExit: any

	beforeAll(() => {
		orgProcessExit = process.exit
		mockExit = jest.fn()
		process.exit = mockExit
	})
	afterAll(() => {
		// @ts-ignore
		process.exit = orgProcessExit
	})
	test('House', async () => {
		let house = new House(['window0', 'window1', 'window2'], ['room0', 'room1'])

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
	})

	test('TestClass', async () => {
		let testClass = new TestClass()

		expect(testClass.returnValue('123')).toEqual('123')
		const cb = jest.fn((name: string, name2: string) => {
			return 'cb' + name + name2
		})
		expect(testClass.callFunction(cb, 'a', 'b')).toEqual('cbab')

		testClass.exitProcess(0)
		expect(mockExit).toHaveBeenCalledTimes(1)

		testClass.exitProcess(20)
		await wait(30)
		expect(mockExit).toHaveBeenCalledTimes(2)

	})
	function wait (time: number) {
		return new Promise((resolve) => {
			setTimeout(resolve, time)
		})
	}
})
