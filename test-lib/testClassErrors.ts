import { EventEmitter } from 'events'
import { readFileSync, writeFileSync } from 'fs'

export class TestClassErrors extends EventEmitter {

	private lastAsyncError: Error | null = null
	private unhandledPromiseRejections: string[] = []

	constructor (options: {failInConstructorAfter?: number, busyConstructorAfter?: number, busyConstructorTimeMs?: number, counterFile?: string}) {
		super()

		// Catch unhandled promises:
		process.on('unhandledRejection', (message) => {
			this.unhandledPromiseRejections.push(`${message}` + (typeof message === 'object' ? (message as any).stack : ''))
		})

		if (options.counterFile) {
			let state = '0'
			try {
				state = readFileSync(options.counterFile, {
					encoding: 'utf8'
				})
			} catch (_err) {
				// ignore
			}
			writeFileSync(options.counterFile, String(Number.parseInt(state, 10) + 1))

			if (options.busyConstructorAfter && state === String(options.busyConstructorAfter)) {
				const start = Date.now()
				let i = 0
				while (Date.now() < start + (options.busyConstructorTimeMs ?? 200)) {
					i++
				}
				console.log(i)
			}

			if (options.failInConstructorAfter && state === String(options.failInConstructorAfter)) {
				throw new Error('Error in constructor')
			}
		}
	}
	public doError (): void {
		throw new Error('TestError in doError')
	}
	public doSyntaxError (): void {
		// @ts-ignore
		DaleATuCuerpoAlegría(Macarena)
	}
	public doAsyncError (): boolean {
		setTimeout(() => {
			// @ts-ignore
			DaleATuCuerpoAlegría(Macarena)
			// throw new Error('Error in setTimeout')
		}, 1)

		return true
	}
	public emitEvent (eventName: string): void {
		this.emit(eventName, 'testData')
		// await Promise.resolve(this.emit(eventName, 'testData'))
	}
	public rejectUnhandledPromise (): void {
		setTimeout(() => {
			// @ts-ignore unhandled promise
			return new Promise((_, reject) => {
				reject(new Error('Rejecting promise!'))
			})
		}, 1)
	}
	public emitEventAsync (eventName: string): void {
		setTimeout(() => {
			Promise.resolve()
			.then(async () => {
				try {
					await Promise.resolve(this.emit(eventName, 'testData'))
				} catch (error) {
					this.lastAsyncError = error
				}
			})
			.catch(console.error)
		}, 10)
	}
	public getLastAsyncError (): Error | null {
		return this.lastAsyncError
	}
	public async callCallback (cb: () => Promise<any>): Promise<any> {
		const value = await cb()
		return value
	}
	public getUnhandledPromiseRejections (): string[] {
		return this.unhandledPromiseRejections
	}
	public clearUnhandledPromiseRejections (): void {
		this.unhandledPromiseRejections = []
	}

	public receiveValue (_value: any): void {
		// Do nothing
	}
	public returnValue<T> (value: T): T {
		return value
	}
	public returnInvalidValue (): any {
		// Functions can't be returned
		return {
			aFunction: () => {
				// This is an empty function
			}
		}
	}
	// set valueError (_val: any) {
	// 	// throw new Error('TestError in set valueError')
	// }
	// get valueError (): any {
	// 	throw new Error('TestError in get valueError')
	// }

}
