export function isBrowser (): boolean {
	return !(process && process.stdin)
}
export function isNodeJS (): boolean {
	return !isBrowser()
}
export function browserSupportsWebWorkers (): boolean {
	// @ts-ignore
	return !!(isBrowser() && window.Worker)
}
