"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// import { EventEmitter } from 'events'
const Emittery = require("emittery");
const uuid = require("uuid");
class EventEmitter2 {
    constructor() {
        this.emittery = new Emittery();
        this.unubscribeFunctions = {};
    }
    // addListener(event: string | symbol, listener: (...args: any[]) => void): this;
    on(event, listener) {
        const unsubId = uuid.v4();
        this.unubscribeFunctions[unsubId] = this.emittery.on(event, listener);
        return unsubId;
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
    emit(event, ...args) {
        return this.emittery.emit(event, ...args);
    }
}
exports.EventEmitter2 = EventEmitter2;
// function fib (num: number) {
// 	let result = 0
// 	if (num < 2) {
// 		result = num
// 	} else {
// 		result = fib(num - 1) + fib(num - 2)
// 	}
// 	return result
// }
class House extends EventEmitter2 {
    // private _lamps: number = 0
    // private _readonly: number = 42
    // private _writeonly: number = 0
    constructor(windows, rooms) {
        super();
        this.windows = [];
        this._rooms = [];
        this.windows = windows;
        this._rooms = rooms;
    }
    // public returnValue<T> (value: T): T {
    // 	return value
    // }
    getWindows(_a) {
        if (_a) {
            return [_a, ...this.windows];
        }
        return this.windows;
    }
    setWindows(windows) {
        return this.windows = windows;
    }
    getRooms() {
        return this._rooms;
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
    // public slowFib (num: number) {
    // 	return fib(num)
    // }
    doEmit(str) {
        return this.emit(str);
    }
}
exports.House = House;
