var threadedClass = require('./threadedclass')

var startTime = 0
function log (str) {
    if (str) {
        var obj = document.getElementById("console")
        obj.innerText += (Date.now() - startTime) + 'ms ' + str.toString() + '\n'
    }
}
function runThreads (threaded) {
    startTime = Date.now()
    if (threaded) {
        log('Starting in threaded mode...')
    } else {
        log('Starting in non-threaded-mode...')
    }

    var parallell = 10

    var promises = []

    for (var i = 0; i < parallell; i++) {
        promises.push(doTask(i, threaded))
    }
    Promise.all(promises)
    .then(() => {
        log('All tasks are done!')
    })
}
function doTask (i, threaded) {
    
    return new Promise((resolve, reject) => {

        log(`Creating class ${i}...`)

        Promise.resolve(
            threaded ?
            threadedClass('./myClass.js', MyClass, []) :
            new MyClass()
        )
        .then((myClass) => {
            log(`Starting task ${i}...`)
            return myClass.doSomethingSlow()
        })
        .then(() => {
            log(`Task ${i} done`)
        })

    })
}