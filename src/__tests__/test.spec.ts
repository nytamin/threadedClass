
import { House } from './classes/house'
import { CasparCG } from 'casparcg-connection'
import { StringDecoder, NodeStringDecoder } from 'string_decoder'
import { threadedClass } from '../index'

test('import own class', async () => {

	let original = new House(['north', 'west'], ['south'])

	expect(original.getWindows('asdf')).toHaveLength(2)
	expect(original.getRooms()).toHaveLength(1)

	let threaded = await threadedClass<House>('./classes/house.js', House, [['north', 'west'], ['south']])

	expect(await threaded.getWindows('asdf')).toHaveLength(2)
	expect(await threaded.getRooms()).toHaveLength(1)

	threaded._destroyChild()
})
test('eventEmitter', async () => {

	let threaded = await threadedClass<House>('./classes/house.js', House, [['north', 'west'], ['south']])

	let onEvent = jest.fn()
	await threaded.on('test', onEvent)

	await threaded.doEmit('test')

	await new Promise((resolve) => { setTimeout(resolve, 200) })
	expect(onEvent).toHaveBeenCalledTimes(1)

	threaded._destroyChild()
})
test('method with callback', async () => {

	let threaded = await threadedClass<House>('./classes/house.js', House, [['north', 'west'], ['south']])

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
	for (let i = 0; i < 10; i++) {

		let myHouse = new House(['aa', 'bb'], [])

		results.push(myHouse.slowFib(37))
	}
	// let endTime = Date.now()

	// console.log('Single-thread: ', results.length, endTime - startTime)
	expect(results).toHaveLength(10)
})

test('multi-thread', async () => {
	// let startTime = Date.now()
	let results: Array<number> = []

	let ps: any = []

	for (let i = 0; i < 10; i++) {
		ps.push(
			threadedClass<House>('./classes/house.js', House, [['aa', 'bb'], []])
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
	expect(results).toHaveLength(10)
})

test('properties', async () => {
	let original = new House([], ['south'])

	original._windows = ['west', 'south']
	expect(original.getWindows('asdf')).toHaveLength(2)
	expect(original.getRooms()).toHaveLength(1)

	let threaded = await threadedClass<House>('./classes/house.js', House, [[], ['south']])

	threaded._windows = ['west', 'south']
	expect(await threaded.getWindows('asdf')).toHaveLength(2)
	expect(await threaded.getRooms()).toHaveLength(1)

	threaded._destroyChild()
})
// TODO: support this:
// class House2 {

// 	public _windows: Array<string> = []
// 	private _rooms: Array<string> = []
// 	constructor (windows, rooms) {
// 		this._windows = windows
// 		this._rooms = rooms
// 	}

// 	public getWindows () {
// 		return this._windows
// 	}

// 	public get windows () {
// 		return this._windows
// 	}
// 	public getRooms () {
// 		return this._rooms
// 	}
// }
// test('internal class', async () => {
// 	let myHouse = await threadedClass<House2>(null, House2, ['aa', 'bb'])

// 	expect(await myHouse.getWindows()).toHaveLength(2)

// 	myHouse._destroyChild()
// })
