
import { EventEmitter2 } from './house'
import type { TransferableTypes, ReturnTypes } from './tmp'

export class TestClass extends EventEmitter2 {

	private myself: TestClass

	private param1: any

	constructor (param1?: any) {
		super()

		// circular reference, so that function that return self (such as EventEmitter.on can have trouble)
		this.myself = this
		this.myself = this.myself

		this.param1 = param1
	}
	public async getId (): Promise<string> {
		return 'abc'
	}
	public async returnValue<T extends TransferableTypes> (value: T): Promise<T> {
		return value
	}
	public async returnParam1 () {
		return this.param1
	}
	public async callFunction<T extends TransferableTypes> (fcn: (...args: TransferableTypes[]) => Promise<T>, ...args: TransferableTypes[]): Promise<T> {
		return fcn(...args)
	}
	public async setParam1 (val: any) {
		return this.param1 = val
	}
	public async callParam1<T extends ReturnTypes> (...args: TransferableTypes[]): Promise<T> {
		return this.param1(...args)
	}
	public async callParam1Function<T extends ReturnTypes> (...args: any[]): Promise<T> {
		return this.param1.fcn(...args)
	}
	// public async callChildFunction<T> (obj: { fcn: (...args: any[]) => T }, ...args: any[]): Promise<T> {
	// 	return obj.fcn(...args)
	// }
	public async throwError () {
		throw new Error('Error thrown')
	}
	public async throwErrorString () {
		throw 'Error string thrown' // tslint:disable-line
	}
	public async exitProcess (time: number): Promise<void> {
		if (!time) {
			process.exit(1)
		} else {
			setTimeout(() => {
				process.exit(1)
			}, time)
		}
	}
	public async logSomething (...args: any[]) {
		console.log(...args)
	}
	public async freeze () {
		while (true) {
			// do nothing, but freeze
		}
	}
	public waitReply<T extends string | number> (waitTime: number, reply: T): Promise<T> {
		return new Promise((resolve) => {
			setTimeout(() => {
				resolve(reply)
			}, waitTime)
		})
	}
	public async getCircular (val: any) {
		let o: any = {
			a: 1,
			b: 2,
			val: val
		}
		o.c = o
		return o
	}
	public emitMessage (name: string, val: any) {
		return this.emit(name, val)
	}
	public async getSelf (): Promise<any> {
		return this
	}
}
