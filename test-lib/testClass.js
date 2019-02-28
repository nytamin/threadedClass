"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class TestClass {
    returnValue(value) {
        return value;
    }
    callFunction(fcn, ...args) {
        return fcn(...args);
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
    freeze () {
		while (true) {
			// do nothing, but freeze
		}
    }
    waitReply (waitTime, reply) {
		return new Promise((resolve) => {
			setTimeout(() => {
				resolve(reply)
			}, waitTime)
		})
    }
    getCircular (val) {
		let o = {
			a: 1,
            b: 2,
            val: val
		}
		o.c = o
		return o
	}
}
exports.TestClass = TestClass;
