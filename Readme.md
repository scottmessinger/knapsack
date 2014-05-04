## What is this?

A library to turn [localforage](http://http://mozilla.github.io/localForage) into a basic database. It adds collections & indexes on top of the key/value store provided by localforage. Like localforage, it supports both promises and callbacks.

## Why did you write this?

- In my work for [Common Curriculum](http://www.commoncurriculum.com), a collaborative, online lesson planner, I needed a way to store data so teachers can plan their lessons on flaky or nonexistent wireless connections.
- IndexedDb isn't supported by Safari (yet) and the shims/polyfills for it don't fully work.
- WebSQL is a deprecated standards
- `localforage` doesn't support collections, querying, or indexes, making it difficult to manage large amounts of data with it.

## Here's an example...

```javascript

// First initialize localforage
localforage.config({
    name        : 'my-site',
    version     : 1, // only use INTEGERS. Otherwise, browsers using IndexedDb will fail silently.
    storeName   : 'my-site',
    description : 'a great site'
});

// Second, initailaze knapsack
KS.config({
    database: "blog",
    version: 1,
    //  Format: collectionName: array of indexes
    collections: {
        posts: ["title"],
        comments: ["author"],
    }
})

// Third, start using is. There are 5 methods to the public API: add, all, find, remove, and update.
// Like localforage, knapsack supports both promises & callbacks.

// All
KS.db('blog').collection('posts').all()

// Add
KS.db('blog').collection('posts').add({id: 2, title: 'Great Food'})

// Find by id
KS.db('blog').collection('posts').find(2)

// Find by index
KS.db('blog').collection('posts').find('title', 'Great Food')

// Remove
KS.db('blog').collection('posts').remove(2)

// Update
KS.db('blog').collection('posts').update({id: 2, title: 'Mexican Food'})

```

## What makes this noteworthy?

- All operations are added to a queue and exectued sequentially. This helps prevent odd race conditions.
- Powerful Indexes. You can index non strings.
- Simple Api.
- Promises. Everywhere.


## Requirements
- [localforage](https://github.com/mozilla/localForage/)
- [underscore.js](http://underscorejs.org/)


## Testing

Open up `spec/index.html`. Tests are written in qUnit.


## What's next?

- Reindex the database when the version changes
- Add a `.query` method that accepts a comparison function
- Stop using a global and add support for require.js
- Your idea here.

## Thanks to...
[aaronshaf](https://github.com/aaronshaf) for his work on [bongo.js](https://github.com/aaronshaf/bongo.js). I borrowed the API he developed.
