"use strict";
// import { EventEmitter } from 'events'
// import { TransferableTypes } from '../src'
Object.defineProperty(exports, "__esModule", { value: true });
const house_1 = require("./house");
class TestClass extends house_1.EventEmitter2 {
    // private param1: any
    // set Param1 (val: any) {
    // 	this.param1 = val
    // }
    constructor(_param1) {
        super();
        // circular reference, so that function that return self (such as EventEmitter.on can have trouble)
        this.myself = this;
        this.myself = this.myself;
        // this.param1 = param1
    }
    getId() {
        return 'abc';
    }
    returnValue(value) {
        return value;
    }
    // public returnParam1 () {
    // 	return this.param1
    // }
    // public callFunction<T> (fcn: (...args: any[]) => T, ...args: any[]): T {
    // 	return fcn(...args)
    // }
    // public setParam1 (val: any) {
    // 	return this.param1 = val
    // }
    // public callParam1<T> (...args: any[]): T {
    // 	return this.param1(...args)
    // }
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
    exitProcess(time) {
        if (!time) {
            process.exit(1);
        }
        else {
            setTimeout(() => {
                process.exit(1);
            }, time);
        }
    }
    logSomething(...args) {
        console.log(...args);
    }
    freeze() {
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
    getCircular(val) {
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
