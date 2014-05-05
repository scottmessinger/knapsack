KS = window.KS || {}

KS.config = function (opts){
    if (opts.database == undefined){ throw Error("Database must be named") }
    if (opts.version  == undefined){ throw Error("Version must be set") }
    if (opts.collections  == undefined){ throw Error("You must have a map of collections.") }

    KS.databases = {}
    KS.databases[opts.database] = new KS.Database(opts)
}

KS.db = function(name){
    return KS.databases[name]
}

KS.Database = function (opts){
    this.name = opts.database
    this.version = opts.version
    this.collectionNames = opts.collections
    this.collections = {}
    this.brainName = 'ks_' + opts.database + '_brain'
    this.init()
}

KS.Database.prototype.init = function(){

    localforage.setItem(this.brainName, {
        version: this.version,
        collections: this.collectionNames,
        ids: []
    })

    this.ops = []
    this.reactorRunning = false;

    _.each(this.collectionNames, function(indexes, collection){
        this.collections[collection] = new KS.Collection(collection, this, indexes)
    }, this)

    return this
}

KS.Database.prototype.execute = function(collection, resolve, reject, action, args){
    //console.log("registered", action, "on", collection.name)
    this.ops.push({
        collection: collection,
        resolve: resolve,
        reject: reject,
        action: action,
        args: args
    })
    this.runReactor()
}

KS.Database.prototype.runReactor = function(){
    if (this.reactorRunning === true) return;
    if (this.ops.length === 0) return;
    //console.log('run reactor')
    this.reactorRunning = true;
    var self = this;

    var op = this.ops.shift()

    //console.log('starting to execute', op.action, 'on', op.collection.name)
    op.collection[op.action](op.args[0], op.args[1], op.args[2], op.args[3], op.args[4])
    .then(function(value){
        //console.log('excuted', op.action, 'on', op.collection.name, value)
        op.resolve(value)
        self.reactorRunning = false;
        self.runReactor()
    }).catch(function(e){
        self.reactorRunning = false;
        //console.log('ERROR', e, e.stack)
        op.reject(e)
        throw new Error(e)
        self.runReactor()
    })
}



// remove database
KS.Database.prototype.remove = function(opts){ }

// find a collection
KS.Database.prototype.collection = function(name){
    return this.collections[name]
}


KS.Collection = function(name, db, indexes){
    this.name = name;
    this.db = db
    this.brainName = 'ks_' + this.db.name + '_' + this.name + '_brain'
    this.docBaseName = 'ks_' + this.db.name + '_' + this.name + '_'
    this.indexBaseName = 'ks_' + this.db.name + '_' + this.name + '_by_'
    this.addIndexes(indexes)
}

KS.Collection.prototype.addIndexes = function(indexNames){

    this.indexNames = indexNames

    localforage.setItem(this.brainName, {
        indexNames: indexNames,
        ids: []
    })

    var self = this;
    _.each(indexNames, function(indexName){
        self.addIndex(indexName).catch(function(e){console.log(e)})
    }, this)
}

KS.Collection.prototype.addIndex = function(newDoc, cb){
    var self = this;
    var args = arguments
    return new Promise(function(resolve, reject){
        self.db.execute(self, resolve, reject, '_addIndex', args)
    })
}


KS.Collection.prototype.add = function(newDoc, cb){
    var self = this;
    var args = arguments
    return new Promise(function(resolve, reject){
        self.db.execute(self, resolve, reject, '_add', args)
    })
}


KS.Collection.prototype.find = function(newDoc, cb){
    var self = this;
    var args = arguments
    return new Promise(function(resolve, reject){
        self.db.execute(self, resolve, reject, '_find', args)
    })
}


KS.Collection.prototype.all = function(newDoc, cb){
    var self = this;
    var args = arguments
    return new Promise(function(resolve, reject){
        self.db.execute(self, resolve, reject, '_all', args)
    })
}


KS.Collection.prototype.remove = function(newDoc, cb){
    var self = this;
    var args = arguments
    return new Promise(function(resolve, reject){
        self.db.execute(self, resolve, reject, '_remove', args)
    })
}

KS.Collection.prototype.update = function(newDoc, cb){
    var self = this;
    var args = arguments
    return new Promise(function(resolve, reject){
        self.db.execute(self, resolve, reject, '_update', args)
    })
}


KS.Collection.prototype._addIndex  = function(indexName, cb){
    var self = this;
    return new Promise(function(resolve, reject){
        localforage.setItem(self.indexBaseName + indexName, {
            name: indexName,
            values: {}
        })
        .then(function(index){
            resolve(index)
        })
        .catch(function(e){
            reject(e)
        })
    })
}



KS.Collection.prototype._add  = function(doc, cb){
    var self = this;
    return new Promise(function(resolve, reject){
        if (doc.id == undefined || doc.id == null){
            var message = "All objects need an id"
            if (cb){ cb(null, message) }
            reject(message)
            return
        }

        // add the id to the database
        localforage.setItem(self.docBaseName + doc.id, doc)
        .then(function(){
            return localforage.getItem(self.db.brainName)
        })
        .then(function(value){
            value.ids.push(doc.id)
            return localforage.setItem(self.db.brainName, value)
        })
        .then(function(){
            return localforage.getItem(self.brainName)
        })
        .then(function(value){
            value.ids.push(doc.id)
            return localforage.setItem(self.brainName, value)
        })
        .then(function(){
            var promises = []
            if (self.indexNames.length === 0){
                if (cb){ cb()}
                resolve();
            }
            return Promise.all(_.map(self.indexNames, function(indexName){
                if (doc[indexName] == undefined){ return }
                return localforage.getItem(self.indexBaseName + indexName)
            }))
        })
        .then(function(indexes){
            indexes = _.compact(indexes)
            return self._addToIndexes(indexes, doc)
        })
        .then(function(){
            if(cb){cb()}
            resolve()
        })
        .catch(function(e){
            if (cb){ cb(null, e) }
            reject(e)
        })
    })
}

KS.Collection.prototype._addToIndexes = function(indexes, doc){
    //console.log('add to these indexes', indexes)
    var self = this;
    return Promise.all(_.map(indexes, function(index){
        return self._addToIndex(index, doc)
    }))
}

KS.Collection.prototype._addToIndex = function(index, doc){
    var self = this;
    var docValue = JSON.stringify(doc[index.name])
    index.values[docValue] = index.values[docValue] || []
    if (!_.include(index.values[docValue])){
        index.values[docValue].push(doc.id)
    }
    return localforage.setItem(self.indexBaseName + index.name, index)
}

KS.Collection.prototype._find = function(){
    var self = this;
    var cb;
    var args = _.without(Array.prototype.slice.call(arguments), undefined);
    if (typeof _.last(args) == "function"){
        cb = args.pop()
    }
    if (args.length == 1){
        // find by id
        id = args[0]
        return this._findById(id, cb)
    } else {
        // find by index
        index = args[0]
        value  = args[1]
        return this._findByIndex(index, value, cb)
    }
}

KS.Collection.prototype._all = function(cb){
    var self = this;
    return new Promise(function(resolve, reject){
        localforage.getItem(self.brainName)
        .then(function(brain){
            return Promise.all(_.map(brain.ids, function(id){
                return localforage.getItem(self.docBaseName + id)
            }))
        }).then(function(docs){
            docs = _.compact(docs)
            if (cb){ cb(docs) }
            resolve(docs)
        }).catch(function(error){
            if (cb) { cb(null, error) }
            reject(error)
        })
    })
}

KS.Collection.prototype._findById = function(id, cb){
    var self = this;
    return new Promise(function(resolve, reject){
        localforage.getItem(self.docBaseName + id)
        .then(function(doc){
            if (cb)   {cb(doc)}
            resolve(doc)
        })
        .catch(function(error){
            console.log(error, error.stack)
            if (cb)   {cb(null, error)}
            reject(error)
        })
    })
}

KS.Collection.prototype._findByIndex = function(index, value, cb){
    var self = this;

    // this method is a bit messy with how the promises and mixed with callbacks
    return new Promise(function(resolve, reject){
        //console.log('looking at the index', index, 'on', self.name, self.indexBaseName + index)
        localforage.getItem(self.indexBaseName + index)
        .then(function(index){
            //if (index == null || index == undefined) debugger;
            var ids = index.values[JSON.stringify(value)] || []
            if (ids.length == 0){
                //console.log('not in index')
                if (cb){cb([])}
                resolve([])
            } else if (ids.length == 1){
                //console.log('find an id in the index', ids[0])
                return localforage.getItem(self.docBaseName + ids[0])
                .then(function(item){
                    // it was deleted since we searched for it
                    if (item == null){
                        if (cb) {cb([])}
                        resolve([])
                    } else {
                        if (cb) {cb([item])}
                        resolve([item])
                    }
                })
                .catch(function(error){
                    console.log(error, error.stack)
                    if (cb) { cb(null, error) };
                    reject( error )
                })
            } else {
                return Promise.all(ids.map(function(id){
                    return localforage.getItem(self.docBaseName + id)
                }))
                .then(function(values){
                    //console.log(values)
                    values = _.compact(values)
                    //console.log('values after find by index', values)
                    if (cb) { cb(values) }
                    resolve(values)
                }).catch(function(error){
                    console.log(error, error.stack);
                    reject(error);
                })
            }
        }).catch(function(error){ console.log(error, error.stack); reject(error) })
    })


}


KS.Collection.prototype._remove = function(id, cb){
    console.log('remove a document with id', id)
    var self = this;
    return new Promise(function(resolve, reject){
        // remove from localforage
        // remove from db brain
        // remove from collection brain
        // remove from all other indexes
        localforage.getItem(self.docBaseName + id)
        .then(function(docToRemove){
            if (docToRemove){
                return localforage.removeItem(self.docBaseName + id)
                .then(function(){
                    return localforage.getItem(self.db.brainName)
                })
                .then(function(dbBrain){
                    // remove from the databae index
                    dbBrain.ids = _.without(dbBrain.ids, id)
                    return localforage.setItem(self.db.brainName, dbBrain)
                })
                .then(function(){
                    return localforage.getItem(self.brainName)
                })
                .then(function(collectionBrain){
                    collectionBrain.ids = _.without(collectionBrain.ids, id)
                    return localforage.setItem(self.brainName, collectionBrain)
                })
                .then(function(){
                    return Promise.all(_.map(self.indexNames, function(indexName){
                        return localforage.getItem(self.indexBaseName + indexName)
                    }))
                })
                .then(function(indexes){
                    return self._removeFromIndexes(indexes, docToRemove)
                })
                .then(function(){
                    if (cb) { cb() }
                    resolve()
                })
                .catch(function(error){
                    if (cb) { cb(error) }
                    reject(error)
                })
            } else {
                resolve()
            }
        })
    })
}

KS.Collection.prototype._removeFromIndexes = function(indexes, docToRemove){
    var self = this;
    return Promise.all(_.map(indexes, function(index){
        return self._removeFromIndex(index, docToRemove)
    }))
}

KS.Collection.prototype._removeFromIndex = function(index, docToRemove){
    var indexedValue = JSON.stringify(docToRemove[index.name])
    var ids = index.values[indexedValue] || []
    var self = this;

    if (ids.length > 1){
       index.values[indexedValue]  = _.without(index.values[indexedValue], docToRemove.id)
    } else {
        delete index.values[indexedValue]
    }
    return localforage.setItem(self.indexBaseName + index.name, index)
}

KS.Collection.prototype._update = function(newDoc, cb){

    var self = this;

    return new Promise(function(resolve, reject){
        if (newDoc.id == undefined || newDoc.id == null) reject("Doc must have an id");

        var oldDoc;
        var indexNamesToUpdate;
        localforage.getItem(self.docBaseName + newDoc.id)
        .then(function(value){
            oldDoc = value
            if (value == null){
                console.log('doc wasnt found', newDoc)
                if (cb){ cb(null, new Error("Document has already been deleted")) }
                reject(new Error("Document has already been deleted"))
            }
            return localforage.setItem(self.docBaseName + newDoc.id, newDoc)
        })
        .then(function(newDoc){
            indexNamesToUpdate = _.compact(_.map(self.indexNames, function(indexName){
                console.log('oldDoc', oldDoc, index)
                if (oldDoc[indexName] !== newDoc[indexName]){
                    return indexName
                }
            }))
            return Promise.all(_.map(self.indexNames, function(indexName){
                return localforage.getItem(self.indexBaseName + indexName)
            }))
        })
        .then(function(indexes){
            return self._removeFromIndexes(indexes, oldDoc)
        })
        .then(function(){
            return Promise.all(_.map(self.indexNames, function(indexName){
                return localforage.getItem(self.indexBaseName + indexName)
            }))
        })
        .then(function(indexes){
            return self._addToIndexes(indexes, newDoc)
        })
        .then(function(){
            if (cb){cb()}
            resolve()
        })
        .catch(function(error){
            console.log(error, error.stack)
            if (cb) cb(null, error)
            reject(error)
        })
    })
}
