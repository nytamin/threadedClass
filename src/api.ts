// TODO: change this as Variadic types are implemented in TS
// https://github.com/Microsoft/TypeScript/issues/5453
export type ReturnType<T> = T extends (...args: any[]) => infer R ? R : any

export type ThreadedClass<T> = ValidatedClass<T>

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

/** This describes the types that are supported to be transferred either as a parameter or a return type */
export type TransferableTypes = void | undefined | null | number | string | Buffer | boolean | { [key: string]: TransferableTypes } | Array<TransferableTypes> | Promise<TransferableTypes>
// export type TransferableParameters = TransferableTypes | ((...args: TransferableTypes[]) => Promise<TransferableTypes>)

/** Ensure that each property in this set are allowed */
type EnsureTypes<T> = {
	[K in keyof T]: T[K] extends TransferableTypes ? T[K] : never
}

/** Ensure that a given type is a promise that contains something supported */
type EnsureTypeIsPromise<T> = T extends Promise<TransferableTypes> ? T : never
/** Ensure that the type is a function, with allowed parameter and return types */
type FunctionValidateArgs<T extends Function> = T extends (...args: infer K) => infer R ? (...args: EnsureTypes<K>) => EnsureTypeIsPromise<R> : never
/** Ensure that the type is a function, which does not return type never */
type FunctionEnsureNotNever<T extends Function> = ReturnType<T> extends never ? never: T

/** This is a validator that turns anything unsupported into never */
// TODO - property getters/setters?
export type ValidatedClass<T> = { [P in keyof T]: T[P] extends Function ? FunctionEnsureNotNever<FunctionValidateArgs<T[P]>> : never }
