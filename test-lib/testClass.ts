export class TestClass {
	public returnValue<T> (value: T): T {
		return value
	}
	public callFunction<T> (fcn: (...args: any[]) => T, ...args: any[]): T {
		return fcn(...args)
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
}
