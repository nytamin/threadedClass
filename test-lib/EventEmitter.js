"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultEventEmitter = exports.TypedEventEmitter = void 0;
const eventemitter3_1 = require("eventemitter3");
const events_1 = require("events");
class TypedEventEmitter extends eventemitter3_1.EventEmitter {
    constructor() {
        super();
    }
}
exports.TypedEventEmitter = TypedEventEmitter;
class DefaultEventEmitter extends events_1.EventEmitter {
    constructor() {
        super();
    }
}
exports.DefaultEventEmitter = DefaultEventEmitter;
