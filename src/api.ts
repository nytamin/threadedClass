export type Promisify<T> = {
	[K in keyof T]: PromisifyProperty<T[K], K>
}

type PromisifyProperty<T, K> =
	T extends (...args: any) => any
	? K extends 'on'
		// It is an event-emitter, handle that differently:
		? PromisifyEventEmitterOn<T, Parameters<T>[0], Parameters<T>[1]>
		: PromisifyFunction<T>
	: Promise<T>

/** Promisify a function, ie change the return type to be a Promise */
type PromisifyFunction<T extends (...args: any) => any> = (...args: Parameters<T>) => Promise<ReturnType<T>>

/** Special case: Promisify the .on() method for an eventEmitter */
type PromisifyEventEmitterOn<
	T extends (eventName: string, listener: EventListener) => any,
	Event,
	EventListener extends (event: string, ...args: any[]) => any
> = (eventName: Event, listener: (...args: Parameters<EventListener>) => undefined | void) => Promise<ReturnType<T>>

export type ThreadedClass<T> = Promisify<T>

export interface ThreadedClassConfig {
	/** A number between 0 - 1, how large part of a thread the instance takes up. For example; if set to 0.1, a thread will be re-used for up to 10 instances. If not set, a new thread will be created for each instance. */
	threadUsage?: number
	/** Set to an arbitrary id to put the instance in a specific thread. Instances with the same threadIds will be put in the same thread. */
	threadId?: string
	/** If the process crashes or freezes it's automatically restarted. (ThreadedClassManager will emit the "restarted" event upon restart) */
	autoRestart?: boolean
	/** If the process needs to restart, how long to wait for it to initalize, before failing. (default is 1000ms) */
	restartTimeout?: number
	/** If the process is being killed, how long to wait for it to terminate, before failing. (default is 1000ms) */
	killTimeout?: number
	/** Set to true to disable multi-threading, this might be useful when you want to disable multi-threading but keep the interface unchanged. */
	disableMultithreading?: boolean
	/** Set path to worker, used in browser */
	pathToWorker?: string
	/** (milliseconds), how long to wait before considering the child to be unresponsive. (default is 1000 ms) */
	freezeLimit?: number
	/** Optional: name of the instance, used in debugging */
	instanceName?: string

}
export interface WebWorkerMemoryUsage {
	jsHeapSizeLimit: number
	totalJSHeapSize: number
	usedJSHeapSize: number
}
export type MemUsageReportInner = NodeJS.MemoryUsage | WebWorkerMemoryUsage | { error: string }

export type MemUsageReport = MemUsageReportInner & { description: string }
