export const cbError = () => {
	throw new Error('TestError in callback 123')
}
export const cbReject = () => {
	return Promise.reject(new Error('Rejected promise 123'))
}
export const cbReturnBadValue = () => {
	return {
		a: () => {
			// This is a function.
			// ThreadedClass doesn't support functions inside of objects.
			// Sending this will throw a DataCloneError.
		}
	}
}
