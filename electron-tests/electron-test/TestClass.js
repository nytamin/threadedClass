"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestClass = void 0;
const events_1 = require("events");
class TestClass extends events_1.EventEmitter {
    constructor() {
        super();
    }
    getPid() {
        return process.pid;
    }
    getId() {
        return 'abc';
    }
}
exports.TestClass = TestClass;
