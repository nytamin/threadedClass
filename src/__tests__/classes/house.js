"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
class House extends events_1.EventEmitter {
    constructor(windows, rooms) {
        super();
        this._windows = [];
        this._rooms = [];
        this._windows = windows;
        this._rooms = rooms;
    }
    getWindows(a) {
        a = a;
        return this._windows;
    }
    get windows() {
        return this._windows;
    }
    getRooms() {
        return this._rooms;
    }
    slowFib(num) {
        return fib(num);
    }
    doEmit(str) {
        this.emit(str);
    }
    callCallback(d, cb) {
        return new Promise((resolve, reject) => {
            cb(d + ',child')
                .then((result) => {
                resolve(result + ',child2');
            })
                .catch((err) => {
                reject(err);
            });
        });
    }
}
exports.House = House;
let fib = function (num) {
    let result = 0;
    if (num < 2) {
        result = num;
    }
    else {
        result = fib(num - 1) + fib(num - 2);
    }
    return result;
};
//# sourceMappingURL=house.js.map