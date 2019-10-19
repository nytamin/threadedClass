import { threadedClass, ThreadedClassManager } from '..'
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

	class FakeClass {
		basicFcn (cb: () => number) {
			// An example function that is not aware it might want to be run in a threadedClass
			return cb() + 5
		}

		async promiseFcn (cb: () => Promise<number>) {
			// This function is safe for threaded class, as its callback returns a promise
			return await cb() + 5
		}
	}

	test('class promise-callback', async () => {
		const em2 = await threadedClass<FakeClass>('../../test-lib/house.js', FakeClass, [], {
			disableMultithreading: true
		})

		const callback = () => 10

		const res = await em2.promiseFcn(callback)
		expect(res).toEqual(15)
	})
	test('class normal-callback', async () => {
		const em2 = await threadedClass<FakeClass>('../../test-lib/house.js', FakeClass, [], {
			disableMultithreading: true
		})

		const callback = () => 10

		const res = await em2.basicFcn(callback)
		expect(res).toEqual(15)
	})


})
