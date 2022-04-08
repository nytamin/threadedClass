
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
	let totalSingle = 0
	let totalThreaded = 0
	let totalCount = 0
	const sum = () => {
		totalSingle += t.org
		totalThreaded += t.thread
		totalCount++
	}

	console.log('Thread mode: ' + ThreadedClassManager.getThreadMode())

	console.log('Simplest function calls:')
	printResultHeader()
	t = await simple();    printResult(t); sum();
	t = await simple();    printResult(t); sum();
	t = await simple();    printResult(t); sum();

	console.log('Data flowing one way:')
	printResultHeader()
	t = await oneWay(testData.string);    printResult(t); sum();
	t = await oneWay(testData.number);    printResult(t); sum();
	t = await oneWay(testData.object);    printResult(t); sum();

	console.log('Data flowing in both directions:')
	printResultHeader()
	t = await twoWay(testData.string);    printResult(t); sum();
	t = await twoWay(testData.number);    printResult(t); sum();
	t = await twoWay(testData.object);    printResult(t); sum();

	const averageSingle = totalSingle / totalCount
	const averageThreaded = totalThreaded / totalCount

	console.log(`Average single-threaded time: ${averageSingle} ms / call`)
	console.log(`Average multi-threaded time: ${averageThreaded} ms / call`)

	const averageSingleBaseline   = 0.00255 // This is recorded on Johan's machine 2022-04-08
	const averageThreadedBaseline = 0.09420 // This is recorded on Johan's machine 2022-04-08

	const percentageSingle = Math.round((1 - (averageSingle / averageSingleBaseline)) * 100)
	const percentageThreaded = Math.round((1 - (averageThreaded / averageThreadedBaseline)) * 100)

	if (percentageSingle >= 0) console.log(`Single-threaded performance is ${percentageSingle}% faster than the baseline (${averageSingleBaseline})`)
	else console.log(`Single-threaded performance is ${Math.abs(percentageSingle)}% slower than the baseline (${averageSingleBaseline})`)

	if (percentageThreaded >= 0) console.log(`Multi-threaded performance is ${percentageThreaded}% faster than the baseline (${averageThreadedBaseline})`)
	else console.log(`Multi-threaded performance is ${Math.abs(percentageThreaded)}% slower than the baseline (${averageThreadedBaseline})`)

	// (Optional) Clean up & close all threads:
	await ThreadedClassManager.destroyAll()

	console.log('Done')
}
function printResultHeader () {
	console.log(`   Single-thread Multi-thread`)
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
	let threaded = await threadedClass(CLASS_PATH, 'MyClass', [], {
		pathToWorker: 'lib/threadedclass-worker.js'
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
}
window.runTests = runTests

// runTests()
// .catch(console.log)



