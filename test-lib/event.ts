import type { ValidatedClass } from '..'

export class CallbackClass {
	// async basicFcn (cb: () => number) {
	// 	// An example function that is not aware it might want to be run in a threadedClass
	// 	return cb() + 5
	// }

	async promiseFcn (cb: () => Promise<number>) {
		// This function is safe for threaded class, as its callback returns a promise
		return await cb() + 5
	}
}

export const a: ValidatedClass<CallbackClass> = new CallbackClass()
