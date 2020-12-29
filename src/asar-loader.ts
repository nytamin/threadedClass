// Register the asar support. This could be customised/changed if needing something else
const { register, addAsarToLookupPaths } = require('asar-node')
register()
addAsarToLookupPaths()

// WorkerThreads.workerData contains the path to the file that threadedclass wants to execute. Run it now
const WorkerThreads = require('worker_threads')
if (!WorkerThreads.workerData) throw new Error('Missing workerData defining path to load')
require(WorkerThreads.workerData)
