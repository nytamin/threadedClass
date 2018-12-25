export class TestClass {
	public returnValue<T> (value: T): T {
		return value
	}
	public callFunction<T> (fcn: (...args: any[]) => T, ...args: any[]): T {
		return fcn(...args)
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
}
