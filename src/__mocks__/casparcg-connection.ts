
export class CasparCG {
	public host: string
	constructor (options?: any) {
		this.host = options && options.host
	}
	isMock () {
		return true
	}
}
