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
}
exports.TestClass = TestClass;
