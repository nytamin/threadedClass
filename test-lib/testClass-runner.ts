import { threadedClass } from '..'
import { TestClass } from './testClass'

const TESTCLASS_PATH = './testClass.js';

(async function() {
	const child = await threadedClass<TestClass, typeof TestClass>(TESTCLASS_PATH, 'TestClass', [], { })

	// Ensure the child is separate
	const childPid = await child.getPid()

	if (childPid === process.pid) {
		throw new Error('Runnign in same PID')
	}

	// console.log(childPid)
	if (process.send) {
		process.send(childPid)
	}
	process.on('message', () => {
		process.exit(99)
	})
})()
