"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestClass = void 0;
const house_1 = require("./house");
class TestClass extends house_1.EventEmitter2 {
    // set Param1 (val: any) {
    // 	this.param1 = val
    // }
    constructor(param1) {
        super();
        // circular reference, so that function that return self (such as EventEmitter.on can have trouble)
        this.myself = this;
        this.myself = this.myself;
        this.param1 = param1;
    }
    async getId() {
        return 'abc';
    }
    async returnValue(value) {
        return value;
    }
    async returnParam1() {
        return this.param1;
    }
    // public async callFunction<T extends TransferableTypes> (fcn: (...args: TransferableTypes[]) => Promise<T>, ...args: TransferableTypes[]): Promise<T> {
    // 	return fcn(...args)
    // }
    // public setParam1 (val: any) {
    // 	return this.param1 = val
    // }
    callParam1(...args) {
        return this.param1(...args);
    }
    // public callParam1Function<T> (...args: any[]): T {
    // 	return this.param1.fcn(...args)
    // }
    // public callChildFunction<T> (obj: { fcn: (...args: any[]) => T }, ...args: any[]): T {
    // 	return obj.fcn(...args)
    // }
    // public throwError () {
    // 	throw new Error('Error thrown')
    // }
    // public throwErrorString () {
    // 	throw 'Error string thrown' // tslint:disable-line
    // }
    async exitProcess(time) {
        if (!time) {
            process.exit(1);
        }
        else {
            setTimeout(() => {
                process.exit(1);
            }, time);
        }
    }
    async logSomething(...args) {
        console.log(...args);
    }
    async freeze() {
        while (true) {
            // do nothing, but freeze
        }
    }
    waitReply(waitTime, reply) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(reply);
            }, waitTime);
        });
    }
    async getCircular(val) {
        let o = {
            a: 1,
            b: 2,
            val: val
        };
        o.c = o;
        return o;
    }
    emitMessage(name, val) {
        return this.emit(name, val);
    }
}
exports.TestClass = TestClass;
