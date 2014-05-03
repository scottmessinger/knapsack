localforage.config({
    name        : 'knapsack-test',
    version     : 1,
    storeName   : 'knapsack-test',
    description : 'Testing the DB'
});
localforage.setDriver('localStorageWrapper');

module( "Knapsack",{
    setup: function(){
        KS.config({
            database: "blog",
            version: 1,
            collections: {
                posts: ["title"],
                comments: ["author"]
            }
        })
    },
    teardown: function(){
        localforage.clear()
    }

})
asyncTest("it should create a databasebrain", function(){
    expect (2);

    localforage.getItem('ks_blog_brain')
    .then(function(value){
        ok(value.version == 1,  "Database should have the version set")
        deepEqual(value.collections.posts, ['title'],  "Database should have the collections set")
        start()
    })
})
asyncTest("it should create a collectionbrain for each collection", function(){
    expect(1)
    localforage.getItem('ks_blog_posts_brain')
    .then(function(value){
        deepEqual(value.indexNames, ['title'], "should create a brain doc for each collection")
        start()
    })
})

asyncTest("it should add a doc to all the indexes", function(){

    expect(4)

    KS.db('blog').collection('posts').add({id: 2, title: 'Lamps'}, function(){
        var promises = []
        promises.push(localforage.getItem('ks_blog_brain', function(value){
            deepEqual(_.include(value.ids, 2), true, "ID should be added to the brain collection")
        }))
        promises.push(localforage.getItem('ks_blog_posts_brain', function(value){
            deepEqual(_.include(value.ids, 2), true, "ID should be added to the posts collection")
        }))
        promises.push(localforage.getItem('ks_blog_posts_by_title', function(index){
            deepEqual(_.include(index.values[JSON.stringify("Lamps")], 2), true, "ID should be added to the posts index")
        }))
        promises.push(localforage.getItem('ks_blog_posts_2', function(value){
            deepEqual({id: 2, title: 'Lamps'}, value, "Object should be added")
        }))
        Promise.all(promises).then(start)
    })
})

asyncTest("it should find a record", function(){
    expect(2)

    KS.db('blog').collection('posts').add({id: 2, title: 'Lamps'}, function(){
        KS.db('blog').collection('posts').find(2, function(doc){
            deepEqual(doc, {id: 2, title: 'Lamps'}, "Doc should be found")
        })
    })

    KS.db('blog').collection('posts').add({id: 2, title: 'Lamps'}, function(){
        KS.db('blog').collection('posts').find('title', 'Lamps', function(doc){
            deepEqual(doc[0], {id: 2, title: 'Lamps'}, "Doc should be found")
            start()
        })
    })
})

asyncTest("it should remove a record", function(){

    expect(4)

    KS.db('blog').collection('posts').add({id: 2, title: 'Lamps'})
    .then(function(){
        return KS.db('blog').collection('posts').remove(2)})
    .then(function(){
        return KS.db('blog').collection('posts').find(2)
    }).then(function(doc){
        equal(doc, null, "Doc shouldn't be found")
        return localforage.getItem('ks_blog_brain') // master brain
    }).then(function(dbBrain){
        equal(_.include(dbBrain.ids, 2), false, "Should be removed from the db brain")
        return localforage.getItem('ks_blog_posts_brain') // collection brain
    }).then(function(collectionBrain){
        equal(_.include(collectionBrain.ids, 2), false, "Should be removed from the collection brain")
        return localforage.getItem('ks_blog_posts_by_title')
    }).then(function(index){
        equal(_.include(index.values[JSON.stringify("Lamps")], 2), false, "The id should be removed from the index")
        start()
    }).catch(function(e){ console.log(e, e.stack) })
})


asyncTest("it should update a record", function(){

    expect(3)

    KS.db('blog').collection('posts').add({id: 2, title: 'Lamps'})
    .then(function(){
        return KS.db('blog').collection('posts').update({id: 2, title: "Turtles"})
    })
    .then(function(){
        return KS.db('blog').collection('posts').find(2)
    })
    .then(function(doc){
        deepEqual(doc, {id: 2, title: "Turtles"}, "Doc should be updated")
        return localforage.getItem('ks_blog_posts_by_title')
    }).then(function(index){
        console.log(index)
        equal(_.include(index.values[JSON.stringify("Lamps")], 2), false, "The old value should be removed from the index")
        equal(_.include(index.values[JSON.stringify("Turtles")], 2), true, "The new value should be added to the index")
        start()
    })
    .catch(function(e){ console.log(e, e.stack) })
})
