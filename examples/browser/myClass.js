console.log('__MyClass__')
class MyClass {
    doSomethingSlow () {
        this._fib(37)
    }
    /** Calculate fibbonacci number, takes a long time */
    _fib (num) {
        let result = 0
        if (num < 2) {
            result = num
        } else {
            result = this._fib(num - 1) + this._fib(num - 2)
        }
        return result
    }
}