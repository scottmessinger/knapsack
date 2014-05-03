# What is this?

A library to turn [localforage](http://http://mozilla.github.io/localForage) into a basic database. It adds collections & indexes on top of the key/value store provided by localforage.

# What's an example?

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

// Third, start using is.

// Add
KS.db('blog').collection('posts').add({id: 2, title: 'Great Food'}

// Find by id
KS.db('blog').collection('posts').find(2)

// Find by index
KS.db('blog').collection('posts').find('title', 'Great Food')

// Remove
KS.db('blog').collection('posts').remove({id: 2, title: 'Great Food'})

// Update
KS.db('blog').collection('posts').update({id: 2, title: 'Mexican Food'})


```

# Requirements
- [localforage](https://github.com/mozilla/localForage/)
- [underscore.js](http://underscorejs.org/)


# Testing

Open up `spec/index.html`. Tests are written in qUnit.

# Why not use WebSQL or IndexedDb?

- WebSQL is a deprecated standard.
- IndexedDB is a great concept, but it has odd quirks on browsers that support it. On Safari, the two shims aren't complete and break. However, if you're interested in using IndexedDb, I recommend [bongo.js](https://github.com/aaronshaf/bongo.js).



# What's next?

- Reindex the database when the version changes
- Add support for more advance queries
- Your idea here.

# Thanks to...
[aaronshaf](https://github.com/aaronshaf) for his work on [bongo.js](https://github.com/aaronshaf/bongo.js). I borrowed the API he developed.
