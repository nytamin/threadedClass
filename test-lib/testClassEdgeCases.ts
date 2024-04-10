import { EventEmitter } from 'events'

export class TestClassEdgeCases extends EventEmitter {

	private unhandledPromiseRejections: string[] = []

	constructor () {
		super()

		// Catch unhandled promises:
		process.on('unhandledRejection', (message) => {
			this.unhandledPromiseRejections.push(`${message}` + (typeof message === 'object' ? (message as any).stack : ''))
		})
	}

	public getUnhandledPromiseRejections (): string[] {
		return this.unhandledPromiseRejections
	}
	public clearUnhandledPromiseRejections (): void {
		this.unhandledPromiseRejections = []
	}

	public async callCallback (cb: () => Promise<any>): Promise<any> {
		const value = await cb()
		return value
	}

}
