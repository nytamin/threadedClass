const { threadedClass, ThreadedClassManager, RegisterExitHandlers }  = require('threadedclass')
ThreadedClassManager.handleExit = RegisterExitHandlers.YES

;(async () => {

	// Instantiate a class:
	const instance = await timeoutPromise(
		threadedClass('./TestClass.js', 'TestClass', []),
		2000,
		"set up threadedclass"
	)
	// Verify that the instance works:
	const id = await timeoutPromise(
		instance.getId(),
		2000,
		"getid()"
	)
	if (id !== 'abc') throw new Error('.getId() should have returned "abc"')
})()
.then(() => {
	process.exit(0)
}).catch((err) => {
	console.error(err)
	process.exit(1)
})

function timeoutPromise(p, timeoutTime, context) {
	return Promise.race([
		p,
		new Promise((_,reject) => setTimeout(() => reject(`Timeout after ${timeoutTime}, context: "${context}"`), timeoutTime))
	])

}
