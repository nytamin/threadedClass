import Emittery = require('emittery')
import uuid = require('uuid')
import type { TransferableTypes } from './tmp'

export type HandlerId = string
export class EventEmitter2 {
	private readonly emittery: Emittery
	private readonly unubscribeFunctions: { [key: string]: Emittery.UnsubscribeFn }

	constructor () {
		this.emittery = new Emittery()
		this.unubscribeFunctions = {}
	}

	// addListener(event: string | symbol, listener: (...args: any[]) => void): this;
	on (event: string, listener: () => Promise<void>): Promise<HandlerId> { // listener: (...args: TransferableTypes[]) => Promise<void>
		const unsubId = uuid.v4()
		this.unubscribeFunctions[unsubId] = this.emittery.on(event, listener)
		return Promise.resolve(unsubId)
	}
	// once(event: string | symbol, listener: (...args: any[]) => void): this;
	// prependListener(event: string | symbol, listener: (...args: any[]) => void): this;
	// prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this;
	// removeListener(event: string | symbol, listener: (...args: any[]) => void): this;
	// off(event: string | symbol, listener: (...args: any[]) => void): this;
	// removeAllListeners(event?: string | symbol): this;
	// setMaxListeners(n: number): this;
	// getMaxListeners(): number;
	// listeners(event: string | symbol): Function[];
	// rawListeners(event: string | symbol): Function[];
	emit (event: string, ...args: TransferableTypes[]): Promise<void> {
		return this.emittery.emit(event, ...args)
	}
	// eventNames(): Array<string | symbol>;
	// listenerCount(type: string | symbol): number;
}

// export type TS = ValidatedClass<EventEmitter2>

// type FunctionPropertyNames<T> = { [K in keyof T]: T[K] extends Function ? K : never }[keyof T]
// export type tstsdf = FunctionPropertyNames<EventEmitter2>

function fib (num: number) {
	let result = 0
	if (num < 2) {
		result = num
	} else {
		result = fib(num - 1) + fib(num - 2)
	}
	return result
}
export class House extends EventEmitter2 {

	private windows: Array<string> = []
	private _rooms: Array<string> = []
	// private _lamps: number = 0
	// private _readonly: number = 42
	// private _writeonly: number = 0
	constructor (windows: Array<string>, rooms: Array<string>) {
		super()
		this.windows = windows
		this._rooms = rooms
	}
	public async returnValue<T extends TransferableTypes> (value: T): Promise<T> {
		return value
	}
	public async getWindows (_a: string): Promise<string[]> {
		if (_a) {
			return [_a, ...this.windows]
		}
		return this.windows
	}
	public async setWindows (windows: Array<string>): Promise<string[]> {
		return this.windows = windows
	}
	public async getRooms (): Promise<string[]> {
		return this._rooms
	}
	// public get getterRooms () {
	// 	return this._rooms
	// }
	// public set lamps (l: number) {
	// 	this._lamps = l
	// }
	// public get lamps () {
	// 	return this._lamps
	// }
	// public get readonly () {
	// 	return this._readonly
	// }
	// public set writeonly (value: number) {
	// 	this._writeonly = this._writeonly
	// 	this._writeonly = value
	// }
	public async slowFib (num: number) {
		return fib(num)
	}
	public doEmit (str: string) {
		return this.emit(str)
	}
	public callCallback (d: string, cb: (d2: string) => Promise<string>): Promise<string> {
		return new Promise((resolve, reject) => {
			cb(d + ',child')
			.then((result) => {
				resolve(result + ',child2')
			})
			.catch((err) => {
				reject(err)
			})
		})
	}
}
