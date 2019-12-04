// import { EventEmitter } from 'events'

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

// interface DontWantThis2 extends EventEmitter {
// }
// interface DontWantThis extends EventEmitter {
// 	blah (): number
// }

// interface WantThis {
// 	blah (): Promise<number>
// }

// interface NotAllowed {
// 	a: null // TODO - this will break soonish
// }

// class IgnoreThisClass { // TODO - fix this
// }

export type BasicTypes = void | undefined | null | number | string | Buffer | boolean
export type ReturnableTypes = BasicTypes | { [key: string]: TransferableTypes } | Array<TransferableTypes>
export type TransferableTypes = ReturnableTypes | Promise<TransferableTypes>
export type TransferableParameters = TransferableTypes | ((...args: TransferableTypes[]) => Promise<TransferableTypes>)

// type MakePromise<T extends Function> = (ReturnType<T> extends TransferableTypes ? Promise<T> : never) // TODO Maybe we dont want to enforce returning a promise for this?

// type MustReturnPromise<T extends Function> = (ReturnType<T> extends TransferableTypes ? T : never) // TODO Maybe we dont want to enforce returning a promise for this?
// type MustReturnPromise<T extends Function> = (ReturnType<T> extends Promise<TransferableTypes> ? T : never)
// type OtherOrMustReturnPromise<T extends Function | TransferableTypes> = T extends Function ? MustReturnPromise<T> : T // What was this for?
// type ValidateType<T> = T extends TransferableTypes ? T : never

// TODO - the types of these params dont look strict at all?
// type Func0<T extends Function> = T extends () => infer R ? MustReturnPromise<() => R> : never
// type Func1<T extends Function> = T extends (arg1: infer A1) => infer R ? MustReturnPromise<(arg1: A1) => R> : never
// type Func2<T extends Function> = T extends (arg1: infer A1, arg2: infer A2) => infer R ? MustReturnPromise<(arg1: A1, arg2: A2) => R> : never
// type FuncN<T extends Function> = T extends (...args: infer A) => infer R ? MustReturnPromise<(...args: A) => R> : never
// type SomeFunc<T extends Function> = T extends (...args: TransferableTypes[]) => unknown ? Func0<T> | Func1<T> | Func2<T> | FuncN<T> : never
// export type EnforceFunctionValidity<T> = T extends Function ? SomeFunc<T> : T

export type EnforceTypeValidity<T> = T extends TransferableTypes ? T : never
export type EnforceTypes<T> = {
	[K in keyof T]: EnforceTypeValidity<T[K]>
}


type ArgsAAAA<T extends (...args: any) => any> = T extends (...args: infer K) => any ? K : never
type ReturnTypeIsPromise<T> = T extends Promise<ReturnableTypes> ? T : never
type FunctionValidateArgs<T extends Function> = T extends (...args: infer K) => infer R ? (...args: EnforceTypes<K>) => ReturnTypeIsPromise<R> : never
type FunctionEnsureNotNever<T extends Function> = ReturnType<T> extends never ? never: T

export type ArgsAAAAb = ArgsAAAA<(a: string, b: () => Function) => Promise<void>>
// export const faaa: Func1<() => Promise<void>> = () => Promise.resolve()
export type Abcd = EnforceTypes<ArgsAAAAb>
export type asdsad = FunctionEnsureNotNever<FunctionValidateArgs<() => void>>
export type asdsad2 = FunctionEnsureNotNever<FunctionValidateArgs<(a: Object) => Promise<void>>>

export type ValidatedClass<T> = { [P in keyof T]: T[P] extends Function ? FunctionEnsureNotNever<FunctionValidateArgs<T[P]>> : never }

// type Callable<T extends (...args: any[]) => any> = T
// export const f: Callable<(a: never) => number> = (_a) => 5

// export type ValidatedClass<T> = { [P in keyof T]: T[P] extends Function ? Func1<T[P]> : string }


// function Something2<T extends Function> (_obj: EnforceFunctionValidity<T>) {
// 	return 5
// }

// Something2<() => number>(() => 5)
// Something2<() => Promise<Array<NotAllowed>>>(() => Promise.resolve([{}]))
// Something2<() => Promise<Array<number>>>(() => Promise.resolve([6]))
// Something2<() => Promise<number>>(() => Promise.resolve(5))
// Something2<(a: number) => Promise<number>>((_a: number) => Promise.resolve(5))
// Something2<(a: number) => Promise<Buffer>>((_a: number) => Promise.resolve(Buffer.from('4')))
// Something2<(a: Buffer) => Promise<number>>((_a: Buffer) => Promise.resolve(5))
// Something2<(a: NotAllowed) => Promise<number>>((_a: NotAllowed) => Promise.resolve(5))
// Something2<(a: IgnoreThisClass) => Promise<number>>((_a: IgnoreThisClass) => Promise.resolve(5))
// Something2<(a: number) => Promise<IgnoreThisClass>>((_a: number) => Promise.resolve(new IgnoreThisClass()))
// Something2<(a: (b: number) => number) => Promise<number>>((_b: (_a: number) => number) => Promise.resolve(5))


// // type Func2<T extends Function> = T extends (arg1: infer U1, arg2: infer U2) => infer R ? CheckFunctionReturnsPromise<(arg1: EnforceValidity<U1>, arg2: EnforceValidity<U2>) => R> : string
// // const a: Required<WantThis>['blah'] = () => Promise.resolve(5)
// // const b: Required<DontWantThis>['blah'] = () => Promise.resolve(5)
// // console.log(a, b)

// function Something<T> (_obj: ValidatedClass<T>) {
// 	return 5
// }
// Something<DontWantThis2>({} as any as DontWantThis2)
// Something<DontWantThis>({} as any as DontWantThis)
// Something<WantThis>({} as any as WantThis)

// interface DontWantThis3 {
// 	blah (ab: () => number): Promise<number>
// }

// interface WantThis3 {
// 	blah (ab: number): Promise<number>
// }

// // // export type WT3a = Required<WantThis3>
// // // export type DWT3a = Required<DontWantThis3>
// Something<DontWantThis3>({} as any as DontWantThis3)
// Something<WantThis3>({} as any as WantThis3)
