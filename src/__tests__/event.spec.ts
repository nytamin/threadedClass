import { threadedClass, ThreadedClassManager } from '..'
import { CallbackClass } from '../../test-lib/event'
// import { EventEmitter } from 'events'

describe('EventEmitter', () => {
	beforeEach(async () => {
		await ThreadedClassManager.destroyAll()
		expect(ThreadedClassManager.getThreadCount()).toEqual(0)
	})
	afterEach(async () => {
		await ThreadedClassManager.destroyAll()
		expect(ThreadedClassManager.getThreadCount()).toEqual(0)
	})

	// test('non-threadedclass emit', () => {
	// 	const em = new EventEmitter()
	// 	em.on('test', () => {
	// 		throw new Error('abc')
	// 	})

	// 	try {
	// 		em.emit('test')
	// 	} catch (e) {
	// 		// Finish here
	// 		return
	// 	}
	// 	// Should end in the catch
	// 	expect(false).toBeTruthy()
	// })
	// test('threadedclass emit', async () => {
	// 	// class EventEmitterExt extends EventEmitter {
	// 	// 	doEmit (str: string) {
	// 	// 		this.emit(str)
	// 	// 	}
	// 	// }
	// 	const em2 = await threadedClass<EventEmitter>('./nope.js', EventEmitter, [], {
	// 		disableMultithreading: true
	// 	})
	// 	console.log('init')

	// 	await em2.on('nope', console.log)

	// 	await em2.on('test', (a: any, b: any) => {
	// 		console.log('on', a, b)
	// 		throw new Error('abc')
	// 	})

	// 	console.log('register')

	// 	try {
	// 		await em2.emit('test', 1, 5)
	// 	} catch (e) {
	// 		// Finish here
	// 		return
	// 	}
	// 	// Should end in the catch
	// 	expect(false).toBeTruthy()
	// })

	test('class promise-callback', async () => {
		const em2 = await threadedClass<CallbackClass, typeof CallbackClass>('../../test-lib/event.js', 'CallbackClass', [], {
			disableMultithreading: true
		})

		const callback = async () => 10

		const res = await em2.promiseFcn(callback)
		expect(res).toEqual(15)
	})
	// test('class normal-callback', async () => {
	// 	const em2 = await threadedClass<CallbackClass, typeof CallbackClass>('../../test-lib/event.js', 'CallbackClass', [], {
	// 		disableMultithreading: true
	// 	})

	// 	const callback = () => 10

	// 	const res = await em2.basicFcn(callback)
	// 	expect(res).toEqual(15)
	// })


})
