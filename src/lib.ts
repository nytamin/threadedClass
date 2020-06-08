/**
 * Returns true if running in th browser (if not, then we're in NodeJS)
 */
export function isBrowser (): boolean {
	return !(process && process.hasOwnProperty('stdin'))
}
export function browserSupportsWebWorkers (): boolean {
	// @ts-ignore
	return !!(isBrowser() && window.Worker)
}
export function nodeSupportsWorkerThreads () {
	const workerThreads = getWorkerThreads()
	return !!workerThreads
}

export function getWorkerThreads (): typeof import('worker_threads') | null {
	try {
		const workerThreads = require('worker_threads')
		return workerThreads
	} catch (e) {
		return null
	}
}
