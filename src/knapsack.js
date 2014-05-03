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

    _.each(this.collectionNames, function(indexes, collection){
        this.collections[collection] = new KS.Collection(collection, this, indexes)
    }, this)

    return this
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

KS.Collection.prototype.addIndexes = function(indexes){

    this.indexNames = indexes

    localforage.setItem(this.brainName, {
        indexNames: indexes,
        ids: []
    })
    _.each(indexes, function(index){
        localforage.setItem(this.indexBaseName + index, {name: index, values: {}})
    }, this)

}
KS.Collection.prototype.add  = function(doc, cb){
    var self = this;
    return new Promise(function(resolve, reject){
        if (doc.id == undefined){
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
            return self._addToIndexes(indexes, doc)
        })
        .then(function(){
            if(cb){cb()}
            resolve()
        })
        .catch(function(e){
            if (cb){ cb(null, e) }
            reject()
        })
    })
}

KS.Collection.prototype._addToIndexes = function(indexes, doc){
    var self = this;
    return Promise.all(_.map(indexes, function(index){
        return self._addToIndex(index, doc)
    }))
}

KS.Collection.prototype._addToIndex = function(index, doc){
    var self = this;
    var docValue = doc[index.name]
    index.values[docValue] = index.values[docValue] || []
    if (!_.include(index.values[docValue])){
        index.values[docValue].push(doc.id)
    }
    return localforage.setItem(self.indexBaseName + index.name, index)
}

KS.Collection.prototype.find = function(){
    var self = this;
    if (arguments.length < 3){
        id = arguments[0]
        cb = arguments[1]
        return this._simpleFind(id, cb)
    } else {
        index = arguments[0]
        value  = arguments[1]
        cb = arguments[2]
        return this._indexFind(index, value, cb)
    }
}

KS.Collection.prototype._simpleFind = function(id, cb){
    var self = this;
    return new Promise(function(resolve, reject){
        localforage.getItem(self.docBaseName + id)
        .then(function(doc){
            if (cb)   {cb(doc)}
            resolve(doc)
        })
        .catch(function(error){
            if (cb)   {cb(null, error)}
            reject(error)
        })
    })
}

KS.Collection.prototype._indexFind = function(index, value, cb){
    var self = this;


    // this method is a bit messy with how the promises and mixed with callbacks
    return new Promise(function(resolve, reject){
        localforage.getItem(self.indexBaseName + index)
        .then(function(index, error){
            var ids = index.values[value]
            if (ids.length == 0){
                if (cb)   {cb([], error)}
                if (error){reject(error)}
                resolve([])
            } else if (ids.length > 1){
                localforage.getItem(self.docBaseName + ids[0], function(item, error){
                    if (cb)   {cb(item, error)}
                    if (error){reject(error)}
                    resolve(item)
                })
            } else {
                Promise.all(ids.map(function(id){
                    return localforage.getItem(self.docBaseName + id)
                }))
                .then(function(values, error){
                    if (cb)   {cb(values, error)}
                    if (error){reject(error)}
                    resolve(values)
                })
            }
        }).catch(function(error){ reject(error) })
    })


}


KS.Collection.prototype.remove = function(id, cb){
    var self = this;
    return new Promise(function(resolve, reject){
        // remove from localforage
        // remove from db brain
        // remove from collection brain
        // remove from all other indexes
        localforage.getItem(self.docBaseName + id)
        .then(function(docToRemove){
            localforage.removeItem(self.docBaseName + id)
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
                self._removeFromIndexes(indexes, docToRemove)
            })
            .then(function(){
                if (cb) { cb() }
                resolve()
            })
            .catch(function(error){
                if (cb) { cb(error) }
                reject(error)
            })
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
    var ids = index.values[docToRemove[index.name]]
    var indexedValue = docToRemove[index.name]
    var self = this;
    if (ids.length > 1){
       index.values[indexedValue]  = _.without(index.values[indexedValue], id)
    } else {
        delete index.values[indexedValue]
    }
    return localforage.setItem(self.indexBaseName + index.name, index)
}

KS.Collection.prototype.update = function(newDoc){
    var self = this;

    return new Promise(function(resolve, reject){
        if (newDoc.id == undefined || newDoc.id == null) reject("Doc must have an id");

        var oldDoc;
        var indexNamesToUpdate;
        localforage.getItem(self.docBaseName + newDoc.id)
        .then(function(value){
            oldDoc = value
            return localforage.setItem(self.docBaseName + newDoc.id, newDoc)
        })
        .then(function(newDoc){
            indexNamesToUpdate = _.compact(_.map(self.indexNames, function(indexName){
                if (oldDoc[indexName] !== newDoc[indexName]){
                    return indexName
                }
            }))
            console.log(indexNamesToUpdate)
            return Promise.all(_.map(self.indexNames, function(indexName){
                return localforage.getItem(self.indexBaseName + indexName)
            }))
        })
        .then(function(indexes){
            console.log(indexes)
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
            if (cb) cb(null, error)
            reject(error)
        })
    })
}
