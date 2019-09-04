# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.6.6](https://github.com/nytamin/threadedClass/compare/0.6.5...0.6.6) (2019-09-04)


### Bug Fixes

* make error messages clearer ([c5505f9](https://github.com/nytamin/threadedClass/commit/c5505f9))

### [0.6.5](https://github.com/nytamin/threadedClass/compare/0.6.4...0.6.5) (2019-09-03)


### Bug Fixes

* add note to stack trace on error replies ([0322313](https://github.com/nytamin/threadedClass/commit/0322313))
* be more descriptive in error messages ([ea37bef](https://github.com/nytamin/threadedClass/commit/ea37bef))
* make logging output log instance id ([5e4190c](https://github.com/nytamin/threadedClass/commit/5e4190c))
* make onEvent return a method for removing the listener ([d877d24](https://github.com/nytamin/threadedClass/commit/d877d24))


### Features

* be able to name instances ([77e72c1](https://github.com/nytamin/threadedClass/commit/77e72c1))

### [0.6.4](https://github.com/nytamin/threadedClass/compare/0.6.3...0.6.4) (2019-08-24)


### Bug Fixes

* don't monitor orphaned child in single-threaded mode (this kills the parent process) ([1432f16](https://github.com/nytamin/threadedClass/commit/1432f16))
* update dependencies ([ce99482](https://github.com/nytamin/threadedClass/commit/ce99482))

### [0.6.3](https://github.com/nytamin/threadedClass/compare/0.6.2...0.6.3) (2019-07-16)


### Bug Fixes

* upgrade dependencies (after security audit) ([f093cff](https://github.com/nytamin/threadedClass/commit/f093cff))



### [0.6.2](https://github.com/nytamin/threadedClass/compare/0.6.1...0.6.2) (2019-06-07)



## [0.6.1](https://github.com/nytamin/threadedClass/compare/0.6.0...0.6.1) (2019-04-14)



# [0.6.0](https://github.com/nytamin/threadedClass/compare/0.5.0...0.6.0) (2019-04-14)


### Bug Fixes

* proper termination of worker thread ([2850a70](https://github.com/nytamin/threadedClass/commit/2850a70))


### Features

* remove JSON.stringify, to increase performance (message is still stringified at send, no need to do it twice) ([28b53c9](https://github.com/nytamin/threadedClass/commit/28b53c9))
* Support for worker_threads ([c6ee116](https://github.com/nytamin/threadedClass/commit/c6ee116))



# [0.5.0](https://github.com/nytamin/threadedClass/compare/0.4.3...0.5.0) (2019-03-07)


### Features

* direct import of class, when in single thread mode ([a14c162](https://github.com/nytamin/threadedClass/commit/a14c162))



<a name="0.4.0"></a>
# [0.4.0](https://github.com/nytamin/threadedClass/compare/0.3.4...0.4.0) (2019-02-05)


### Features

* child detect if it's been orphaned ([7b9895c](https://github.com/nytamin/threadedClass/commit/7b9895c))
* implement ping & freeze detection of child proces, and autoRestart ([d6ebd53](https://github.com/nytamin/threadedClass/commit/d6ebd53))



<a name="0.3.4"></a>
## [0.3.4](https://github.com/nytamin/threadedClass/compare/0.3.3...0.3.4) (2019-02-01)



<a name="0.3.3"></a>
## [0.3.3](https://github.com/nytamin/threadedClass/compare/0.3.2...0.3.3) (2019-02-01)



<a name="0.3.2"></a>
## [0.3.2](https://github.com/nytamin/threadedClass/compare/0.3.1...0.3.2) (2019-02-01)



<a name="0.3.1"></a>
## [0.3.1](https://github.com/nytamin/threadedClass/compare/0.3.0...0.3.1) (2019-02-01)



<a name="0.3.0"></a>
# [0.3.0](https://github.com/nytamin/threadedClass/compare/0.2.1...0.3.0) (2019-02-01)


### Features

* add browser example ([ccd2ff7](https://github.com/nytamin/threadedClass/commit/ccd2ff7))
* implement browser support, using web-workers ([61e5028](https://github.com/nytamin/threadedClass/commit/61e5028))



<a name="0.2.1"></a>
## [0.2.1](https://github.com/nytamin/threadedClass/compare/0.2.0...0.2.1) (2019-01-04)


### Bug Fixes

* falsy values ([3bca924](https://github.com/nytamin/threadedClass/commit/3bca924))



<a name="0.2.0"></a>
# [0.2.0](https://github.com/nytamin/threadedClass/compare/v0.1.0...v0.2.0) (2018-12-26)


### Bug Fixes

* cleanup unused functionality ([01aaf6e](https://github.com/nytamin/threadedClass/commit/01aaf6e))
* handle thrown errors & renaming of some methods ([b819d50](https://github.com/nytamin/threadedClass/commit/b819d50))
* handle undefined parameter ([70f34b1](https://github.com/nytamin/threadedClass/commit/70f34b1))
* renamed more references of "process" to "thread", for consistency ([51d97ad](https://github.com/nytamin/threadedClass/commit/51d97ad))


### Features

* added ThreadedClassManager.onEvent, for listening to process-closed-events. Added restart function, to restart crashed devices. ([3ed3986](https://github.com/nytamin/threadedClass/commit/3ed3986))
* disableMultithreading option starts a special non threaded class ([5e24f55](https://github.com/nytamin/threadedClass/commit/5e24f55))
* proper support for functions as arguments & proper handling of value types ([c66bf9c](https://github.com/nytamin/threadedClass/commit/c66bf9c))
* rename options.processId to threadId ([58be1cb](https://github.com/nytamin/threadedClass/commit/58be1cb))
* rename options.processUsage to threadUsage ([177e264](https://github.com/nytamin/threadedClass/commit/177e264))
* restart process now returns promise ([0899424](https://github.com/nytamin/threadedClass/commit/0899424))
* reworked the whole thing. Added support for multiple instances of classes running in the same process. Added ThreadedClassManager singleton to use for cleaning up instances ([f2b96e9](https://github.com/nytamin/threadedClass/commit/f2b96e9))



<a name="0.1.0"></a>
# [0.1.0](https://github.com/nytamin/threadedClass/compare/v0.0.5...v0.1.0) (2018-12-11)


### Bug Fixes

* handle nested prototypes ([5eac783](https://github.com/nytamin/threadedClass/commit/5eac783))
* typo ([b540a3b](https://github.com/nytamin/threadedClass/commit/b540a3b))


### Features

* added better support for getters & setters ([94d7d53](https://github.com/nytamin/threadedClass/commit/94d7d53))
* non-ideal-but-reasonable support for getters ([422b466](https://github.com/nytamin/threadedClass/commit/422b466))
* support setting properties ([b042426](https://github.com/nytamin/threadedClass/commit/b042426))
