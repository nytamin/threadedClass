// TODO: change this as Variadic types are implemented in TS
// https://github.com/Microsoft/TypeScript/issues/5453
export type ReturnType<T> = T extends (...args: any[]) => infer R ? R : any

export type Promisify<T> = {
	[K in keyof T]: PromisifyProperty<T[K]>
}

type PromisifyProperty<T> = T extends Function ? (...args: any[]) => Promise<ReturnType<T>> : Promise<T>

export type ThreadedClass<T> = Promisify<T>

export interface ThreadedClassConfig {
	/** A number between 0 - 1, how big a part pf a process the class takes up. For example; if set to 0.1, a process will be re-used for up to 10 class instances */
	threadUsage?: number
	/** Put the instance in a specific process. Instances with the same threadIds will be put in the same process. */
	threadId?: string
	/** TO BE IMPLEMENTED: If the process crashes it's restarted. (ThreadedClassManager will emit the "restarted" event upon restart) */
	autoRestart?: boolean
	/** Set to true to disable multi-threading, this might be useful when you want to disable multi-threading but keep the interface unchanged */
	disableMultithreading?: boolean
}
