"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const casparcg_connection_1 = require("casparcg-connection");
class TestClass2 {
    constructor() {
        this.ccg = new casparcg_connection_1.CasparCG();
    }
    isOkay() {
        if (this.ccg)
            return true;
        else
            return false;
    }
}
exports.TestClass2 = TestClass2;
