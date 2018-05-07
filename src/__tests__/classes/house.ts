import { EventEmitter } from 'events'

function fib (num) {
	let result = 0
	if (num < 2) {
		result = num
	} else {
		result = fib(num - 1) + fib(num - 2)
	}
	return result
}
export class House extends EventEmitter {

	public _windows: Array<string> = []
	private _rooms: Array<string> = []
	constructor (windows, rooms) {
		super()
		this._windows = windows
		this._rooms = rooms
	}

	public getWindows (a: string) {
		a = a
		return this._windows
	}
	public get windows () {
		return this._windows
	}
	public getRooms () {
		return this._rooms
	}
	public slowFib (num: number) {
		return fib(num)
	}
	public doEmit (str: string) {
		this.emit(str)
	}
	public callCallback (d: string, cb: (d2: string) => Promise<string>) {
		return new Promise((resolve, reject) => {
			cb(d + 'child')
			.then((result) => {
				resolve(result + 'child2')
			})
			.catch((err) => {
				reject(err)
			})
		})
	}
}
