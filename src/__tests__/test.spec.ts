
import { House } from '../../test-lib/house'
import { CasparCG } from 'casparcg-connection'
import { StringDecoder, NodeStringDecoder } from 'string_decoder'
import { threadedClass } from '../index'

const HOUSE_PATH = '../../test-lib/house.js'
test('import own class', async () => {

	let original = new House(['north', 'west'], ['south'])

	expect(original.getWindows('asdf')).toHaveLength(2)
	expect(original.getRooms()).toHaveLength(1)

	let threaded = await threadedClass<House>(HOUSE_PATH, House, [['north', 'west'], ['south']])

	expect(await threaded.getWindows('asdf')).toHaveLength(2)
	expect(await threaded.getRooms()).toHaveLength(1)

	threaded._destroyChild()
})
test('eventEmitter', async () => {

	let threaded = await threadedClass<House>(HOUSE_PATH, House, [['north', 'west'], ['south']])

	let onEvent = jest.fn()
	await threaded.on('test', onEvent)

	await threaded.doEmit('test')

	await new Promise((resolve) => { setTimeout(resolve, 200) })
	expect(onEvent).toHaveBeenCalledTimes(1)

	threaded._destroyChild()
})

test('method with callback', async () => {

	let threaded = await threadedClass<House>(HOUSE_PATH, House, [['north', 'west'], ['south']])

	let onEvent = jest.fn()
	await threaded.on('test', onEvent)

	let result = await threaded.callCallback('parent', (str) => {
		return str + ',parent2'
	})

	// await new Promise((resolve) => { setTimeout(resolve, 200) })
	expect(result).toEqual('parent,child,parent2,child2')

	threaded._destroyChild()
})

test('import library class', async () => {

	let original = new CasparCG({
		host: '192.168.0.1',
		autoConnect: false
	})
	expect(original.host).toEqual('192.168.0.1')
	// console.log(options)

	let threaded = await threadedClass<CasparCG>('casparcg-connection', CasparCG, [{
		host: '192.168.0.1',
		autoConnect: false
	}])
	expect(await threaded.host).toEqual('192.168.0.1')

	threaded._destroyChild()
})

test('import native class', async () => {

	let original = new StringDecoder('utf8')

	// €-sign:
	let euroSign = original.end(Buffer.from([0xE2, 0x82, 0xAC]))
	expect(euroSign).toEqual('€')

	let threaded = await threadedClass<NodeStringDecoder>('string_decoder', StringDecoder, ['utf8'])

	let euroSign2 = await threaded.end(Buffer.from([0xE2, 0x82, 0xAC]))

	expect(euroSign2).toEqual(euroSign)

	threaded._destroyChild()
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
	let results: Array<number> = []

	let ps: any = []

	for (let i = 0; i < 5; i++) {
		ps.push(
			threadedClass<House>(HOUSE_PATH, House, [['aa', 'bb'], []])
			.then((myHouse) => {
				return myHouse.slowFib(37)
			})
			.then((result) => {
				results.push(result)
			})
		)
	}
	await Promise.all(ps)
	// let endTime = Date.now()

	// console.log('Multi-thread: ', results.length, endTime - startTime)
	expect(results).toHaveLength(5)
})

test('properties', async () => {
	let original = new House([], ['south'])

	original.setWindows(['west', 'south'])
	expect(original.getWindows('asdf')).toHaveLength(2)
	expect(original.windows).toHaveLength(2)
	expect(original.getRooms()).toHaveLength(1)
	expect(original.getterRooms).toHaveLength(1)

	original.lamps = 91
	expect(original.lamps).toEqual(91)

	let threaded = await threadedClass<House>(HOUSE_PATH, House, [[], ['south']])

	await threaded.setWindows(['west', 'south'])
	// console.log('threaded.getWindows', threaded.getWindows)
	expect(await threaded.getWindows('asdf')).toHaveLength(2)

	let pWindows = threaded.windows
	expect(pWindows).toHaveProperty('then')
	expect(await pWindows).toHaveLength(2)
	expect(await threaded.getRooms()).toHaveLength(1)
	let pGetterRooms = threaded.getterRooms
	expect(pWindows).toHaveProperty('then')
	expect(await pGetterRooms).toHaveLength(1)

	// @ts-ignore this technically works, though the typings do not:
	threaded.lamps = 91
	expect(await threaded.lamps).toEqual(91)

	threaded._destroyChild()
})
