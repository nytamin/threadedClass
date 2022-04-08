"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestClass2 = void 0;
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
        // // @ts-ignore
        // if (this.ccg && this.ccg.isMock()) return true
        // return false
    }
}
exports.TestClass2 = TestClass2;
