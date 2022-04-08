
var threadedClass = ThreadedClass.threadedClass
var ThreadedClassManager = ThreadedClass.ThreadedClassManager
const testData = {
    string: 'alkdfjnawiefbalwkbr3lkh4rb2lj4rb2l3h4bfljh34bf',
    number: 21351.1513132118,
    object: {asfgsdfg: 'asdfawf3', bdfghdfgh: '56he5h6e5he', certyertyerty: 3, ddhfgty4353g4: 'fi3h4fi34fhi3f', esdfgsg4g4rgwerg: { asegseryujtyuj: 1, besgw3r3grw34g: 'f3i473w4ufgi34gf3w64ufg3'}}
}
const CLASS_PATH = '../myClass.js' // This is the path to the js-file (not a ts-file!) that contains the class

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

	let original = new MyClass()
	let threaded = await threadedClass(CLASS_PATH, MyClass, [], {
		pathToWorker: 'threadedclass-worker.js'
	})
	
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
window.runTests = runTests

// runTests()
// .catch(console.log)



