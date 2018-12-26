import { threadedClass, ThreadedClassManager } from 'threadedclass'

import { House } from '../test-lib/house'
const HOUSE_PATH = './test-lib/house.js' // This is the path to the js-file (not a ts-file!) that contains the class

async function runExample () {

	// Create instance of the class House:
	let originalHouse = new House(['north', 'west'], ['entrance','kitchen', 'bedroom'])

	// Create threaded instance of the class House:
	let threadedHouse = await threadedClass<House>(HOUSE_PATH, House, [['north', 'west'], ['entrance','kitchen', 'bedroom']])

	// Print number of rooms:
	console.log(originalHouse.getRooms()) // ['entrance','kitchen', 'bedroom']

	// Print number of rooms from the threaded instance (using await because all methods are now promises)
	console.log(await threadedHouse.getRooms()) // ['entrance','kitchen', 'bedroom']

	// (Optional) Clean up & close all processes:
	ThreadedClassManager.destroyAll()
}

runExample()
.catch(console.log)
