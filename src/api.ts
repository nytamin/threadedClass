// TODO: change this as Variadic types are implemented in TS
// https://github.com/Microsoft/TypeScript/issues/5453
export type ReturnType<T> = T extends (...args: any[]) => infer R ? R : any

export type Promisify<T> = {
	[K in keyof T]: PromisifyProperty<T[K]>
}

type PromisifyProperty<T> = T extends Function ? (...args: any[]) => Promise<ReturnType<T>> : Promise<T>

export type ThreadedClass<T> = Promisify<T>

export interface ThreadedClassConfig {
	/** A number between 0 - 1, how big a part pf a process the class takes up. If set to 0.1, a process will be re-used for up to 10 class instances */
	processUsage?: number
	/** Put the instance in a specific process. Instances with the same processIds will be put in the same process. */
	processId?: string
	/** If the process crashes it's restarted. (ThreadedClassManager will emit the "restarted" event upon restart) */
	autoRestart?: boolean
	/** Optionally you can choose to disable multi threading, this might be useful for keeping one version of typings */
	disableMultithreading?: boolean
}
