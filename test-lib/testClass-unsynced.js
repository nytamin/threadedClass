"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
class TestClass extends events_1.EventEmitter {
    constructor() {
        super();
    }
    getId() {
		return 'unsynced'
	}
}
exports.TestClass = TestClass;
