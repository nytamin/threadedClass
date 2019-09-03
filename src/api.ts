// TODO: change this as Variadic types are implemented in TS
// https://github.com/Microsoft/TypeScript/issues/5453
export type ReturnType<T> = T extends (...args: any[]) => infer R ? R : any

export type Promisify<T> = {
	[K in keyof T]: PromisifyProperty<T[K]>
}

type PromisifyProperty<T> = T extends Function ? (...args: any[]) => Promise<ReturnType<T>> : Promise<T>

export type ThreadedClass<T> = Promisify<T>

export interface ThreadedClassConfig {
	/** A number between 0 - 1, how large part of a thread the instance takes up. For example; if set to 0.1, a thread will be re-used for up to 10 instances. */
	threadUsage?: number
	/** Set to an arbitrary id to put the instance in a specific thread. Instances with the same threadIds will be put in the same thread. */
	threadId?: string
	/** If the process crashes or freezes it's automatically restarted. (ThreadedClassManager will emit the "restarted" event upon restart) */
	autoRestart?: boolean
	/** Set to true to disable multi-threading, this might be useful when you want to disable multi-threading but keep the interface unchanged. */
	disableMultithreading?: boolean
	/** Set path to worker, used in browser */
	pathToWorker?: string
	/** (milliseconds), how long to wait before considering the child to be unresponsive. (default is 1000 ms) */
	freezeLimit?: number
	/** Optional: name of the instance, used in debugging */
	instanceName?: string

}
