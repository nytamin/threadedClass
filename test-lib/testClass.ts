import { EventEmitter } from 'events'

export class TestClass extends EventEmitter {

	private myself: TestClass

	private param1: any

	set Param1 (val: any) {
		this.param1 = val
	}

	constructor (param1?: any) {
		super()

		// circular reference, so that function that return self (such as EventEmitter.on can have trouble)
		this.myself = this
		this.myself = this.myself

		this.param1 = param1
	}
	public getPid (): number {
		return process.pid
	}
	public getId (): string {
		return 'abc'
	}
	public returnValue<T> (value: T): T {
		return value
	}
	public returnParam1 () {
		return this.param1
	}
	public callFunction<T> (fcn: (...args: any[]) => T, ...args: any[]): T {
		return fcn(...args)
	}
	public setParam1 (val: any) {
		return this.param1 = val
	}
	public callParam1<T> (...args: any[]): T {
		return this.param1(...args)
	}
	public callParam1Function<T> (...args: any[]): T {
		return this.param1.fcn(...args)
	}
	public callChildFunction<T> (obj: { fcn: (...args: any[]) => T }, ...args: any[]): T {
		return obj.fcn(...args)
	}
	public throwError () {
		throw new Error('Error thrown')
	}
	public throwErrorString () {
		throw 'Error string thrown' // tslint:disable-line
	}
	public exitProcess (time: number): void {
		if (!time) {
			process.exit(1)
		} else {
			setTimeout(() => {
				process.exit(1)
			}, time)
		}
	}
	public logSomething (...args: any[]) {
		console.log(...args)
	}
	public freeze () {
		while (true) {
			// do nothing, but freeze
		}
	}
	public waitReply (waitTime: number, reply: any) {
		return new Promise((resolve) => {
			setTimeout(() => {
				resolve(reply)
			}, waitTime)
		})
	}
	public getCircular (val: any) {
		let o: any = {
			a: 1,
			b: 2,
			val: val
		}
		o.c = o
		return o
	}
	public emitMessage (name: string, val: any) {
		this.emit(name, val)
	}
	public getSelf (): TestClass {
		return this
	}
}
