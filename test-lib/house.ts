import { EventEmitter } from 'events'

function fib (num: number) {
	let result = 0
	if (num < 2) {
		result = num
	} else {
		result = fib(num - 1) + fib(num - 2)
	}
	return result
}
export class House extends EventEmitter {

	public windows: Array<string> = []
	private _rooms: Array<string> = []
	private _lamps: number = 0
	private _readonly: number = 42
	private _writeonly: number = 0
	constructor (windows: Array<string>, rooms: Array<string>) {
		super()
		this.windows = windows
		this._rooms = rooms
	}
	public returnValue<T> (value: T): T {
		return value
	}
	public getWindows (_a: string) {
		return this.windows
	}
	public setWindows (windows: Array<string>) {
		return this.windows = windows
	}
	public getRooms () {
		return this._rooms
	}
	public get getterRooms () {
		return this._rooms
	}
	public set lamps (l: number) {
		this._lamps = l
	}
	public get lamps () {
		return this._lamps
	}
	public get readonly () {
		return this._readonly
	}
	public set writeonly (value: number) {
		this._writeonly = this._writeonly
		this._writeonly = value
	}
	public slowFib (num: number) {
		return fib(num)
	}
	public doEmit (str: string) {
		this.emit(str)
	}
	public callCallback (d: string, cb: (d2: string) => Promise<string>) {
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
