import { nodeSupportsWorkerThreads } from '../lib'
import isRunning = require('is-running')
import { fork } from 'child_process'

const TESTCLASS_RUNNER_PATH = './test-lib/testClass-runner.js'

function sleep (duration: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, duration))
}

describe('lib', () => {
	if (!nodeSupportsWorkerThreads()) {
		test('Ensure child stops with parent', async () => {
			const childProcess = fork(TESTCLASS_RUNNER_PATH)
			try {
				let childPid = 0
				childProcess.on('message', (d) => childPid = Number(d))

				const parentPid = childProcess.pid
				expect(isRunning(parentPid)).toBeTruthy()

				// Wait and ensure parent is still running
				await sleep(7000)
				expect(isRunning(parentPid)).toBeTruthy()

				// Ensure child is running
				expect(childPid).not.toEqual(0)
				expect(childPid).not.toEqual(NaN)
				expect(isRunning(childPid)).toBeTruthy()

				// Kill the parent
				childProcess.kill('SIGKILL')
				// childProcess.send('ba')
				await sleep(100)
				expect(isRunning(parentPid)).toBeFalsy()
				expect(isRunning(childPid)).toBeTruthy()

				// Still alive
				await sleep(1000)
				expect(isRunning(childPid)).toBeTruthy()

				// Now gone
				await sleep(5000)
				expect(isRunning(childPid)).toBeFalsy()

			} finally {
				childProcess.kill()
			}
		}, 15000)
	} else {
		test('nothing to run', () => {
			// Nothing to do
		})
	}
})
