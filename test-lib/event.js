"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.a = exports.CallbackClass = void 0;
class CallbackClass {
    // async basicFcn (cb: () => number) {
    // 	// An example function that is not aware it might want to be run in a threadedClass
    // 	return cb() + 5
    // }
    async promiseFcn(cb) {
        // This function is safe for threaded class, as its callback returns a promise
        return await cb() + 5;
    }
}
exports.CallbackClass = CallbackClass;
exports.a = new CallbackClass();
