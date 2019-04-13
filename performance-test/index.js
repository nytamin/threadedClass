
const { threadedClass, ThreadedClassManager } = require('../dist')

const testData = require('./testData.js')
const { TestClass } = require('./testClass.js')
const CLASS_PATH = './testClass.js' // This is the path to the js-file (not a ts-file!) that contains the class

async function runTests () {

	var t = {}

	console.log('Thread mode: ' + ThreadedClassManager.getThreadMode())
	
	console.log('Simplest function calls')
	t = await simple();    printResult(t);
	t = await simple();    printResult(t);
	t = await simple();    printResult(t);

	console.log('Data flowing one way')
	t = await oneWay(testData.string);    printResult(t);
	t = await oneWay(testData.number);    printResult(t);
	t = await oneWay(testData.object);    printResult(t);

	console.log('Data flowing in both directions')
	t = await twoWay(testData.string);    printResult(t);
	t = await twoWay(testData.number);    printResult(t);
	t = await twoWay(testData.object);    printResult(t);
	

	await twoWay()

	// (Optional) Clean up & close all threads:
	await ThreadedClassManager.destroyAll()
	
	console.log('Done')
	process.exit(0)
}
function printResult (t) {
	console.log(`${slice(t.org, 8)}    ${slice(t.thread, 8)} ms / call`)
}
function slice (str, length) {
	return (str + '').slice(0, length)
}
function pad (str, length) {
	str = (str+'')

	return ('                  '.slice(0, length - str.length) + str)
}

async function simple () {
	return await prepareTest('simple')
}
async function oneWay (data) {
	return await prepareTest('oneWay', data)
}
async function twoWay (data) {
	return await prepareTest('twoWay', data)
}

async function prepareTest (fcnName, data) {

	let original = new TestClass()
	let threaded = await threadedClass(CLASS_PATH, TestClass, [])
	
	var orgFcn = original[fcnName]
	var threadFcn = threaded[fcnName]

	var t = {
		org: await runTest(() => {
			return orgFcn(data)
		}),
		thread: await runTest(() => {
			return threadFcn(data)
		})
	}
	
	return t
}

async function runTest (fcn, checkIteration) {
	if (!checkIteration) checkIteration = 100

	const minElapsedTime = 2000

	var runCount = 0

	var startTime = Date.now()
	var elapsedTime = 0
	while (elapsedTime < minElapsedTime) {
		for (var i = 0; i < checkIteration; i++) {
			await fcn()
			runCount++
		}
		elapsedTime = Date.now() - startTime
	}

	return elapsedTime / runCount
	return (Math.round((elapsedTime / runCount)*1000000)/1000000)
}

runTests()
.catch(console.log)



