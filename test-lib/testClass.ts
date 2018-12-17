export class TestClass {
	public returnValue<T> (value: T): T {
		return value
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
