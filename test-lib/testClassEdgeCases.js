"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestClassEdgeCases = void 0;
const tslib_1 = require("tslib");
const events_1 = require("events");
class TestClassEdgeCases extends events_1.EventEmitter {
    constructor() {
        super();
        this.unhandledPromiseRejections = [];
        // Catch unhandled promises:
        process.on('unhandledRejection', (message) => {
            this.unhandledPromiseRejections.push(`${message}` + (typeof message === 'object' ? message.stack : ''));
        });
    }
    getUnhandledPromiseRejections() {
        return this.unhandledPromiseRejections;
    }
    clearUnhandledPromiseRejections() {
        this.unhandledPromiseRejections = [];
    }
    callCallback(cb) {
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            const value = yield cb();
            return value;
        });
    }
}
exports.TestClassEdgeCases = TestClassEdgeCases;
