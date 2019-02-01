# Change Log

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

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
