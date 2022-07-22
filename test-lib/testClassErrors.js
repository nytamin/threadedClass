"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestClassErrors = void 0;
const tslib_1 = require("tslib");
const events_1 = require("events");
class TestClassErrors extends events_1.EventEmitter {
    constructor() {
        super();
        this.lastAsyncError = null;
        this.unhandledPromiseRejections = [];
        // Catch unhandled promises:
        process.on('unhandledRejection', (message) => {
            this.unhandledPromiseRejections.push(`${message}` + (typeof message === 'object' ? message.stack : ''));
        });
    }
    doError() {
        throw new Error('TestError in doError');
    }
    doSyntaxError() {
		DaleATuCuerpoAlegría(Macarena)
	}
    doAsyncError() {
		setTimeout(() => {
			throw new Error('Error in setTimeout');
		}, 1);
        return true;
	}
    emitEvent(eventName) {
        this.emit(eventName, 'testData');
        // await Promise.resolve(this.emit(eventName, 'testData'))
    }
    rejectUnhandledPromise() {
        setTimeout(() => {
            // @ts-ignore unhandled promise
            return new Promise((_, reject) => {
                reject(new Error('Rejecting promise!'));
            });
        }, 1);
    }
    emitEventAsync(eventName) {
        setTimeout(() => {
            Promise.resolve()
                .then(() => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                try {
                    yield Promise.resolve(this.emit(eventName, 'testData'));
                }
                catch (error) {
                    this.lastAsyncError = error;
                }
            }))
                .catch(console.error);
        }, 10);
    }
    getLastAsyncError() {
        return this.lastAsyncError;
    }
    callCallback(cb) {
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            const value = yield cb();
            return value;
        });
    }
    getUnhandledPromiseRejections() {
        return this.unhandledPromiseRejections;
    }
    clearUnhandledPromiseRejections() {
        this.unhandledPromiseRejections = [];
    }
    receiveValue(_value) {
        // Do nothing
    }
    returnInvalidValue() {
        // Functions can't be returned
        return {
            aFunction: () => {
                // This is an empty function
            }
        };
    }
}
exports.TestClassErrors = TestClassErrors;
