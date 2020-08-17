# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [0.8.0](https://github.com/nytamin/threadedClass/compare/0.7.0...0.8.0) (2020-08-17)


### ⚠ BREAKING CHANGES

* drop node 8 support
* remove class constructor from main function. When single-threaded it gets loaded the same way as multithreaded would
* drop node 8 support
* remove class constructor from main function. When single-threaded it gets loaded the same way as multithreaded would

### Features

* add support for exports not named the same as the class ([1cce227](https://github.com/nytamin/threadedClass/commit/1cce2271c567e232ce612e784432dec07cb3ac38))
* add support for exports not named the same as the class ([1cce227](https://github.com/nytamin/threadedClass/commit/1cce2271c567e232ce612e784432dec07cb3ac38))
* drop node 8 support ([a4e3c49](https://github.com/nytamin/threadedClass/commit/a4e3c49e46f1c525ac2d544c0c3dbc7e3e95e0b9))
* drop node 8 support ([a4e3c49](https://github.com/nytamin/threadedClass/commit/a4e3c49e46f1c525ac2d544c0c3dbc7e3e95e0b9))
* monitor parent pid for orphan check ([#33](https://github.com/nytamin/threadedClass/issues/33)) ([597bdf9](https://github.com/nytamin/threadedClass/commit/597bdf9d514019f7b32aa53574c886756a146067))
* monitor parent pid for orphan check ([#33](https://github.com/nytamin/threadedClass/issues/33)) ([597bdf9](https://github.com/nytamin/threadedClass/commit/597bdf9d514019f7b32aa53574c886756a146067))
* refactor workers for better types ([c6aabb0](https://github.com/nytamin/threadedClass/commit/c6aabb008959cf252a0a307a24fb6a1a9d859c44))
* refactor workers for better types ([c6aabb0](https://github.com/nytamin/threadedClass/commit/c6aabb008959cf252a0a307a24fb6a1a9d859c44))
* remove class constructor from main function. When single-threaded it gets loaded the same way as multithreaded would ([f0c0e3f](https://github.com/nytamin/threadedClass/commit/f0c0e3f2c244b50f4a25c61cf8914b142101013d))
* **ci:** prerelease flow & optionally skip audit [skip ci] ([adf1927](https://github.com/nytamin/threadedClass/commit/adf1927f20ddc1308295ff27604692dfc583eac8))
* remove class constructor from main function. When single-threaded it gets loaded the same way as multithreaded would ([f0c0e3f](https://github.com/nytamin/threadedClass/commit/f0c0e3f2c244b50f4a25c61cf8914b142101013d))
* **ci:** prerelease flow & optionally skip audit [skip ci] ([adf1927](https://github.com/nytamin/threadedClass/commit/adf1927f20ddc1308295ff27604692dfc583eac8))


### Bug Fixes

* indentation ([5355f3e](https://github.com/nytamin/threadedClass/commit/5355f3e01e6e0ff3d210dd9ff14c567e6ca6fdff))
* indentation ([5355f3e](https://github.com/nytamin/threadedClass/commit/5355f3e01e6e0ff3d210dd9ff14c567e6ca6fdff))
* use worker_threads typings from @types/node, and don't pass callback to worker.terminate ([34a1614](https://github.com/nytamin/threadedClass/commit/34a16145abf686a9fa9008b07cc0b1d6c5cc0d05))
* use worker_threads typings from @types/node, and don't pass callback to worker.terminate ([34a1614](https://github.com/nytamin/threadedClass/commit/34a16145abf686a9fa9008b07cc0b1d6c5cc0d05))

## [0.7.0](https://github.com/nytamin/threadedClass/compare/0.6.8...0.7.0) (2019-12-12)


### Features

* stricter typings for constructor ([708f9e4](https://github.com/nytamin/threadedClass/commit/708f9e48dc11db890948d710ceef3ad21616a92b))
* update ci to run for node 8,10,12 ([e65d0e0](https://github.com/nytamin/threadedClass/commit/e65d0e076c6704ac8d6ceed6d181b14f4bf02680))


### Bug Fixes

* build before running tests ([d88d28f](https://github.com/nytamin/threadedClass/commit/d88d28fee31fe03125ffc092fe3cd9fade8cecf9))
* build before test during release script ([33df104](https://github.com/nytamin/threadedClass/commit/33df10482e9c8a35a29e4e029740d47213684d88))
* disable broken tests ([9102550](https://github.com/nytamin/threadedClass/commit/9102550eab8f5050a0f22f50e08d0c5eacf38a4d))
* encode/decode constructor arguments ([29eadf8](https://github.com/nytamin/threadedClass/commit/29eadf82e3973ba4d4b7443d3655041c6484cf32))
* functions often undefined ([#23](https://github.com/nytamin/threadedClass/issues/23)) ([312f08c](https://github.com/nytamin/threadedClass/commit/312f08cb70c3c2d08e13f6cbfce0d5c138bf72a2))
* tweak coverage thresholds ([61273a6](https://github.com/nytamin/threadedClass/commit/61273a64fda27a9652a258a57c017f18ee2f740f))

### [0.6.8](https://github.com/nytamin/threadedClass/compare/0.6.7...0.6.8) (2019-10-03)


### Bug Fixes

* allow infinite number of listeners ([aedc713](https://github.com/nytamin/threadedClass/commit/aedc713))

### [0.6.7](https://github.com/nytamin/threadedClass/compare/0.6.6...0.6.7) (2019-10-03)


### Bug Fixes

* include original stack trace in error messages ([c76a866](https://github.com/nytamin/threadedClass/commit/c76a866))

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
