# Threaded class
Fork instances of classes (while keeping typings) with one line of code.

## Getting started
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
This library helps you create an asynchronous version of the instance of that class.
The instance will have _almost_ the same API as the original (all methods return promises instead), but will run in a separate thread. 
```typescript
// Multi-threaded, asynchronous way:
import { threadedClass} from 'threadedclass'
import { Professor } from './professor'

async function getStory() {
  let mrSmith = await threadedClass<Professor>('./professor.js', Professor, ['maths', 'greek'])
  let story = await mrSmith.talkAboutAncientGreece() // still takes a loong time, but now runs in a separate thread
  return story
}
```
The instance returned by `makeThreaded()` has methods equivalent to the original, but all properties will be asynchronous (Promises).

## API
### NodeJS: Typescript example
```typescript
import { threadedClass} from  'threadedclass'
import { Professor } from './professor'

threadedClass<Professor>(
	'./professor.js',     // Path to imported module (this should be the same path as is in require('XX') or import {class} from 'XX'} )
	Professor ,        // The class to be forked
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

* **threadUsage** _Optional_ number
	<br>A number between 0 - 1, how large part of a thread the instance takes up. For example; if set to 0.1, a thread will be re-used for up to 10 instances.
* **threadId** _Optional_ string
	<br>Set to an arbitrary id to put the instance in a specific thread. Instances with the same threadIds will be put in the same thread.
* **disableMultithreading** _Optional_ boolean
	<br>Set to true to disable multi-threading, this might be useful when you want to disable multi-threading but keep the interface unchanged.
* *Not implemented yet:* **autoRestart** _Optional_ boolean
	<br>Set to true to automatically restart a crashed thread. ThreadedClassManager will emit the "restarted" event upon restart.

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
* Non-JSON-encodable types, such as objects with *cyclic references*.
* Instances of classes (the instance will be serialized as JSON and piped through, but its methods will not).

## Known limitations
* The to-be-threaded class must not be referencing any global variables, as the class is run in its own sandbox.
* **No garbage-collection of callback-functions**
	<br> Currently, if you give a callback to a method (like so: `threaded.myMethod(() => {})`) a reference to the method will be stored indefinitely, because we cannot determine if the reference is valid in the child process.
* There is a noticable delay when spawning a new thread, and since each thread is its own Node-process it uses up a few Megabytes of memory. If you intend to spawn many instances of a class, consider using the _threadUsage_ option (for example `threadUsage: 0.1` will put 10 instances in a thread before spawning a new).

## Todo
* Support for NodeJS Worker-threads (added as experimental in version 11)
