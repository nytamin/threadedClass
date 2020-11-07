const { register, addAsarToLookupPaths } = require('asar-node')
const WorkerThreads = require('worker_threads')

register()
addAsarToLookupPaths()

if (!WorkerThreads.workerData) throw new Error('Missing workerData defining path to load')

require(WorkerThreads.workerData)
