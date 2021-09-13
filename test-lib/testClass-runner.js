"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const __1 = require("..");
const TESTCLASS_PATH = './testClass.js';
(function () {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        const child = yield __1.threadedClass(TESTCLASS_PATH, 'TestClass', [], {});
        // Ensure the child is separate
        const childPid = yield child.getPid();
        if (childPid === process.pid) {
            throw new Error('Runnign in same PID');
        }
        // console.log(childPid)
        if (process.send) {
            process.send(childPid);
        }
        process.on('message', () => {
            console.log('die');
            process.exit(99);
        });
    });
})();
