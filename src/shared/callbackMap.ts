export interface Callback {
    readonly id: string
    fun: Function
    count: number
}

export class CallbackMap {
    private byId = new Map<string, Callback>()
    private byFun = new Map<Function, Callback>()

	insert(id: string, fun: Function, count: number): void {
		const callback: Callback = {
			id,
			fun,
			count
		}
		this.byFun.set(fun, callback)
		this.byId.set(id, callback)
	}
	get(idOrFun: string | Function): Callback | undefined {
		return typeof idOrFun === 'function' ? this.byFun.get(idOrFun) : this.byId.get(idOrFun)
	}
    delete(idOrFun: string | Function): void {
        const el = typeof idOrFun === 'function' ? this.byFun.get(idOrFun) : this.byId.get(idOrFun)
		if (!el) return
		this.byFun.delete(el.fun)
		this.byId.delete(el.id)
    }
}
