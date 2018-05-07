# Threaded class
Fork instances of classes with one line of code

## Getting started
Let's say you have a class that has several computational-heavy methods:
```typescript
// Old, single thread way:
import { Professor } from './professor'

function getStory() {
  let mrSmith = new Professor('maths', 'greek')
  let story = mrSmith.talkAboutAncientGreece() // takes a loong time
  return story
}
```
This library helps you create an asynchronous version of the instance of that Class.
The instance will have (almost) the same API as the original one, but will run its computations in a separate thread.
```typescript
// New, multi thread, async way
import { threadedClass} from  'threadedclass'
import { Professor } from './professor'

async function getStory() {
  let mrSmith = await threadedClass<Professor>('./professor', Professor, ['maths', 'greek'])
  let story = await mrSmith.talkAboutAncientGreece() // still takes a loong time, but now runs in a separate process
  return story
}
```
The instance returned by `makeThreaded()` has methods equivalent to the original, but all return values will instead be Promises.

## API
### Typescript
```typescript
import { threadedClass} from  'threadedclass'
import { Professor } from './professor'

threadedClass<Professor>(
	'./professor',     // Path to imported module (this should be the same path as is in require('XX') or import {class} from 'XX'} )
	Professor ,        // The class to be forked
	['maths', 'greek'] // An array of arguments to be fed into the class constructor
)
.then((instance) => {
	return mrSmith.talkAboutAncientGreece() // All methods returns a Promise
})
.then((story) => {
	console.log(story)
})
```
### Javascript
```javascript
var threadedClass = require('threadedclass').threadedClass
var Professor = require('./professor')

threadedClass('./professor', Professor, ['maths', 'greek'])
.then((instance) => {
	return mrSmith.talkAboutAncientGreece() // All methods returns a Promise
})
.then((story) => {
	console.log(story)
})
```

## Features

* Supports classes imported from _your own modules_, _external dependencies_ & _native Node modules_
* When calling methods of instances, supported argument types are: _numbers_, _strings_, _JSON-able objects_, _Buffers_ & _callback functions_ (more to come)
* Supports EventEmitters

## Known limitations
* The classes referenced must not be referencing any global variables, as they run in their own sandbox
* Remember that a new Node-process is spawned for every instance created (a few MBs of memory, so don't create too many)
## Todo
* Browser support, using `web-workers` instead of `child_process`
* Testing
