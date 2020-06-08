# Threaded class
[![CircleCI](https://circleci.com/gh/nytamin/threadedClass.svg?style=svg)](https://circleci.com/gh/nytamin/threadedClass)
[![codecov](https://codecov.io/gh/nytamin/threadedClass/branch/master/graph/badge.svg)](https://codecov.io/gh/nytamin/threadedClass)

Fork instances of classes (while keeping typings) with one line of code.

## Getting started

```
npm install threadedclass
```
Let's say you have a class that has several computational-heavy methods:
```typescript
// Normal, single-threaded way:
import { Professor } from './professor'

function getStory() {
  let mrSmith = new Professor('maths', 'greek')
  let story = mrSmith.talkAboutAncientGreece() // takes a loong time
  return story
}
```
`Threaded-class` helps you create an asynchronous version of the instance of that class.
The instance will have _almost_ the same typings-API as the original (all methods return promises instead), but will run in a separate thread. 
```typescript
// Multi-threaded, asynchronous way:
import { threadedClass} from 'threadedclass'
import { Professor } from './professor'

async function getStory() {
  let mrSmith = await threadedClass<Professor>('./professor.js', 'Professor', ['maths', 'greek'])
  let story = await mrSmith.talkAboutAncientGreece() // still takes a loong time, but now runs in a separate thread
  return story
}
```
The instance returned by `threadedClass()` has methods equivalent to the original, but all properties and methods will be asynchronous (return Promises).

## API
[API reference](https://nytamin.github.io/threadedClass)
### NodeJS: Typescript example
```typescript
import { threadedClass} from  'threadedclass'
import { Professor } from './professor'

threadedClass<Professor>(
   './professor.js',     // Path to imported module (this should be the same path as is in require('XX') or import {class} from 'XX'} )
   'Professor' ,        // The export name for the class to be forked
   ['maths', 'greek'], // Array of arguments to be fed into the class constructor
   {} // Config (see below)
)
.then((instance) => {
   return mrSmith.talkAboutAncientGreece() // All methods returns a Promise
})
.then((story) => {
   console.log(story)
})
```
### NodeJS: Javascript example
```javascript
var threadedClass = require('threadedclass').threadedClass
var Professor = require('./professor')

threadedClass('./professor.js', Professor, ['maths', 'greek'])
.then((instance) => {
   return mrSmith.talkAboutAncientGreece() // All methods returns a Promise
})
.then((story) => {
   console.log(story)
})
```
### Browser: Javascript example
[Example](https://nytamin.github.io/threadedClass/examples/browser.html)
```html
<script type="text/javascript" src="lib/threadedClass.js"></script>
<script type="text/javascript" src="professor.js"></script>
<script type="text/javascript">
   var threadedClass = ThreadedClass.threadedClass

   threadedClass('../professor.js', Professor, ['maths', 'greek'], { // path to module is relative to threadedClass.js
      pathToWorker: 'lib/threadedclass-worker.js' // in browser, a path to the worker-scrip must also be provided
   })
   .then((instance) => {
   return mrSmith.talkAboutAncientGreece() // All methods returns a Promise
   })
   .then((story) => {
      console.log(story)
   })
</script>
```
### Options
An optional options object can be passed to threadedClass() with the following properties:

| Option | Type | Description |
|--|--|--|
| `threadUsage` | number | A number between 0 - 1, how large part of a thread the instance takes up. For example; if set to 0.1, a thread will be re-used for up to 10 instances. |
| `threadId` | string | Set to an arbitrary id to put the instance in a specific thread. Instances with the same threadIds will be put in the same thread. |
| `autoRestart` | boolean | If the process crashes or freezes it's automatically restarted. (ThreadedClassManager will emit the "restarted" event upon restart) |
| `disableMultithreading` | boolean | Set to true to disable multi-threading, this might be useful when you want to disable multi-threading but keep the interface unchanged. |
| `pathToWorker` | string | Set path to worker, used in browser |
| `freezeLimit` | number | (milliseconds), how long to wait before considering the child to be unresponsive. (default is 1000 ms) |

## Features

### Supported imports
* Classes imported from _your own modules_. `import { MyClass } from './myModule'`
* Classes imported from _external dependencies_. `import { DatClass } from 'dat-library'`
* Classes importted from _native Node modules_. `import { StringDecoder } from 'string_decoder'`

### Supported methods, arguments / parameters & return values
When calling a method of your threaded instance (`threaded.myMethod()`), there are some limitations to what data-types are allowed to be provided and returned.

#### Supported data types
* All JSON-serializable types; numbers, strings, arrays, objects etc..
* Buffers
* Functions (such as callbacks or returned functions)

#### Unsupported data types
* Non-JSON-encodable types, such as objects with *cyclic references* (except when in worker_threads, then it's fine).
* Instances of classes (the instance will be serialized as JSON and piped through, but its methods will not).

## Known limitations
* The to-be-threaded class must not be referencing any global variables, as the class is run in its own sandbox.
* **No garbage-collection of callback-functions**
    Currently, if you give a callback to a method (like so: `threaded.myMethod(() => {})`) a reference to the method will be stored indefinitely, because we cannot determine if the reference is valid in the child process.
* There is a noticable delay when spawning a new thread, and since each thread is its own Node-process it uses up a few Megabytes of memory. If you intend to spawn many instances of a class, consider using the _threadUsage_ option (for example `threadUsage: 0.1` will put 10 instances in a thread before spawning a new).

## Under the hood
### Used API:s
Different API:s will be used for threading, depending on the platform:

| Platform | API used   |
| --- | -- |
| [Browser](https://caniuse.com/#feat=webworkers) | Web-workers |
| NodeJS <10.x | Child process |
| NodeJS 10.x - 11.7 | Worker-threads (if `node --experimental-worker` flag is enabled) |
| NodeJS >11.8 | Worker-threads |

### Notes on performance
Doing method-calls to threads is slower than when running in a single thread. The greatest benefit comes when there is heavy computations to be made.

This table shows measured round-trip times of [just calling a method](https://github.com/nytamin/threadedClass/blob/master/performance-test/index.js):

| Platform | API used | Avg. time per call |
|--|--|--|
| NodeJS 8.9.x     | Single-thread mode   | 0.000200 ms per call     |
| NodeJS 8.9.x     | Child process        | **0.117000** ms per call |
| NodeJS 10.15.x   | Single-thread mode   | 0.000080 ms per call     |
| NodeJS 10.15.x   | Child process        | **0.090000** ms per call |
| NodeJS 10.15.x   | Worker-threads       | **0.045000** ms per call |
| NodeJS 11.14.x   | Single-thread mode   | 0.000085 ms per call     |
| NodeJS 11.14.x   | Worker-threads       | **0.047000** ms per call |
| Browser (Chrome) | Single-thread mode   | 0.001500 ms per call     |
| Browser (Chrome) | Web-workers          | **0.140000** ms per call |
