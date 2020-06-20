// export type ThreadedClass<T> = ValidatedClass<T>
// Note: We want to use the raw function definitions whenever possible, as that means we keep any generics and so the api remains the same
export type ThreadedClass<T> = { [P in keyof T]: T[P] extends Function ? T[P] : never }

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
type BasicTypes = void | undefined | null | number | string | Buffer | boolean
export type ReturnTypes = BasicTypes | { [key: string]: ReturnTypes } | Array<ReturnTypes> | ((...args: ReturnTypes[]) => Promise<ReturnTypes>)
export type TransferableTypes = ReturnTypes | { [key: string]: TransferableTypes } | Array<TransferableTypes> | Promise<TransferableTypes> | ((...args: TransferableTypes[]) => Promise<TransferableTypes>)

// export type TransferableParameters = TransferableTypes | ((...args: TransferableTypes[]) => Promise<TransferableTypes>)

/** Ensure that each property in this set are allowed */
type EnsureTypes<T> = {
	[K in keyof T]: T[K] extends TransferableTypes ? T[K] : never
}

/** Ensure that a given type is a promise that contains something supported */
type EnsureTypeIsPromise<T> = T extends Promise<TransferableTypes> ? T : never
/** Ensure that the type is a function, with allowed parameter and return types */
type FunctionValidateArgs<T extends (...args: any) => any> = T extends (...args: infer K) => infer R ? EnsureFunctionParametersNotNever<(...args: EnsureTypes<K>) => EnsureTypeIsPromise<R>> : never
/** Ensure that the type is a function, which does not return type never */
type FunctionEnsureNotNever<T extends (...args: any) => any> = T extends (...args: any[]) => never ? never : T
/** Ensure that one of the function parameters is not never. If it is, then wipe out the whole function */
type EnsureFunctionParametersNotNever<T extends (...args: any) => any> = OmitByValueExact<Parameters<T>, never> extends MapToKeyTypes<Parameters<T>> ? T : never

/** This is a validator that turns anything unsupported into never */
export type ValidatedClass<T> = { [P in keyof T]: T[P] extends (...args: any) => any ? FunctionEnsureNotNever<FunctionValidateArgs<T[P]>> : never }

// To match the output of OmitByValueExact to allow for comparison
type MapToKeyTypes<T> = Pick<T, { [Key in keyof T]-?: Key }[keyof T]>

// From https://github.com/piotrwitek/utility-types/blob/2ae7412a9edf12f34fedbf594facf43cf04f7e32/src/mapped-types.ts#L257
type OmitByValueExact<T, ValueType> = Pick<
  T,
  {
	[Key in keyof T]-?: [ValueType] extends [T[Key]]
	  ? [T[Key]] extends [ValueType]
		? never
		: Key
	  : Key;
  }[keyof T]
>
