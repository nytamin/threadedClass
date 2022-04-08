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
/**
 * Helper function to simply assert that the value is of the type never.
 * Usage: at the end of if/else or switch, to ensure that there is no fallthrough.
 */
export function assertNever (_value: never): void {
	// does nothing
}
export function getErrorStack (err: any): string {
	if (typeof err === 'object') {
		const stack = err.stack
		if (stack) return stack
		return `${err}`
	} else {
		return `${err}`
	}
}
/**
 * Strips a stack trace of the lines following (and including) a number of regexps, each matching a line in the stack trace.
 */
export function stripStack (stack: string, matchLines: RegExp[]): string
export function stripStack (stack: undefined, matchLines: RegExp[]): undefined
export function stripStack (stack: string | undefined, matchLines: RegExp[]): string | undefined {
	if (!stack) return stack

	const stackLines = stack.split('\n')
	let matchIndex = -1
	for (let i = 0; i < stackLines.length; i++) {
		let matching = false
		for (const line of matchLines) {
			if (stackLines[i].match(line)) {
				if (matchIndex === -1) matchIndex = i
				matching = true
				i += 1
			} else {
				matching = false
				break
			}
		}
		if (matching) {
			return stackLines.slice(0, matchIndex).join('\n')
		}
	}
	// else, return the original:
	return stack
}
export function combineErrorStacks (orgError: Error, ...stacks: string[]): Error
export function combineErrorStacks (orgError: string, ...stacks: string[]): string
export function combineErrorStacks (orgError: Error | string, ...stacks: string[]): Error | string
export function combineErrorStacks (orgError: Error | string, ...stacks: string[]): Error | string {

	if (typeof orgError === 'object') {
		const err = new Error(orgError.message)
		err.stack = combineErrorStacks(`${orgError.stack}`, ...stacks)
		return err
	} else {
		return orgError + '\n' + stacks.join('\n')
	}
}
