import { CasparCG } from 'casparcg-connection'

export class TestClass2  {
    private ccg: CasparCG
    constructor () {
        this.ccg = new CasparCG()
    }
    public isOkay(): boolean {
        // @ts-ignore
        if (this.ccg && this.ccg.isMock()) return true
        return false
    }
}
