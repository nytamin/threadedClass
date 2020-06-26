"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
class TestClass extends events_1.EventEmitter {
    constructor(param1) {
        super();
        // circular reference, so that function that return self (such as EventEmitter.on can have trouble)
        this.myself = this;
        this.myself = this.myself;
        this.param1 = param1;
    }
    set Param1(val) {
        this.param1 = val;
    }
    getPid() {
        return process.pid;
    }
    getId() {
        return 'abc';
    }
    returnValue(value) {
        return value;
    }
    returnParam1() {
        return this.param1;
    }
    callFunction(fcn, ...args) {
        return fcn(...args);
    }
    setParam1(val) {
        return this.param1 = val;
    }
    callParam1(...args) {
        return this.param1(...args);
    }
    callParam1Function(...args) {
        return this.param1.fcn(...args);
    }
    callChildFunction(obj, ...args) {
        return obj.fcn(...args);
    }
    throwError() {
        throw new Error('Error thrown');
    }
    throwErrorString() {
        throw 'Error string thrown'; // tslint:disable-line
    }
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
        this.emit(name, val);
    }
    getSelf() {
        return this;
    }
}
exports.TestClass = TestClass;
