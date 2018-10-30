const XXHash = require('xxhash')
const fs = require('fs')
const EventEmitter = require('events')
const path = require('path')

class FileObserver extends EventEmitter {
  constructor(interval) {
    super()
    this.hashes = {}
    if (interval === undefined) interval = 1000
    if (interval != 0 && !(interval == false)) setInterval(this.check.bind(this), interval)
  }

  addFile(file, alias) {
    this.hashes[file] = {
      'hash': '',
      'alias': alias.toString()
    }
  }

  removeFile(file) {
    delete this.hashes[file]
  }

  removeFileByAlias(alias) {
    for(var file in this.hashes) if(file['alias']==alias) delete this.hashes[file]
  }

  check() {
    for (var file in this.hashes) {
      var hasher = new XXHash(0x1C3D50D4)
      fs.createReadStream(file)
      .on('data', function (data) {hasher.update(data)})
      .on('end', (function () {
        var hash = hasher.digest()
        if (this.hashes[file] != hash) {
          if (this.hashes[file] != "") this.emit('vary', file)
          this.hashes[file] = hash
        }
      })
      .bind(this))
    }
  }
}

class DirectoryObserver extends EventEmitter {
  constructor(directory, interval) {
    super()
    this.dir = directory
    this.base = this.hashtree(this.dir)
    this.vary = this.base
    this.changes = this.compare(this.base, this.vary, "")
    if (interval === undefined) { interval = 1000 }
    if (interval != 0 && !(interval == false)) {
      setInterval(this.check.bind(this), interval)
    }

  }

  hashtree(path) { //go throu a directory and hash every file while creating a dictionary based on the structure
    var folder = {}
    try {
      var objects = fs.readdirSync(path)
      for (var i in objects) {
        var fullpath = path + "/" + objects[i]
        var stats = fs.lstatSync(fullpath)
        if (stats.isDirectory()) { folder[objects[i]] = this.hashtree(fullpath) } else {
          var file = fs.readFileSync(fullpath)
          var hash = XXHash.hash(file, 0x1C3D50D4)
          folder[objects[i]] = hash
        }
      }
    } catch (e) this.emit('error', e)
    return folder
  }

  checkpoint(tree) { //update this.base
    if(tree === undefined) this.base = this.hashtree(this.dir)
    else this.base = tree
    this.vary = this.base

  }

  check(emit) {
    if(emit === undefined) emit = true
    else emit = false
    this.vary = this.hashtree(this.dir)
    var newchanges = this.compare(this.base, this.vary, "")
    if (!(JSON.stringify(newchanges) === JSON.stringify(this.changes))) {
      if (!(JSON.stringify(newchanges) === JSON.stringify({addFile:[],addDir:[],delFile:[],delDir:[],edit:[]}))) {
        this.changes = newchanges
        if(emit) this.emit('vary', newchanges)
        else return true
      } else {if(!emit) return false}
    }
  }

  compare(base, vary, path) {
    var protocol = {
      addFile: [],
      addDir: [],
      delFile: [],
      delDir: [],
      edit: []
    }

    // removed things
    for (var key in base) {
      var isDir = typeof base[key] === "object" // object is a foler ?
      if (!(key in vary)) {
        if (isDir) protocol.delDir.push((path + "/" + key).slice(1))
        else protocol.delFile.push((path + "/" + key).slice(1))
      } else {
        //directory wasnt removed? Maybe files init! -> recursion
        if (isDir) {
          var subprotocol = this.compare(base[key], vary[key], (path + "/" + key)) //recursion into subsirectory
          protocol = this.mergeProtocols(protocol, subprotocol)
        }
      }
    }

    //added things
    for (var key in vary) {
      var isDir = typeof vary[key] === "object" // object is a foler ?
      if (!(key in base)) {
        if (isDir) {
          protocol.addDir.push((path + "/" + key).slice(1))
          var subprotocol = this.compare(base[key], vary[key], (path + "/" + key)) //recursion into subsirectory
          protocol = this.mergeProtocols(protocol, subprotocol)
        } else protocol.addFile.push((path + "/" + key).slice(1))
      } else {
        //file is not vary ... but maybe edited?
        if (!isDir && base[key] != vary[key]) {
          protocol.edit.push((path + "/" + key).slice(1))
        }
      }
    }
    return protocol
  }

  mergeProtocols(p1, p2) {
    var p = {}
    p.addFile = [...p1.addFile, ...p2.addFile]
    p.addDir = [...p1.addDir, ...p2.addDir]
    p.delFile = [...p1.delFile, ...p2.delFile]
    p.delDir = [...p1.delDir, ...p2.delDir]
    p.edit = [...p1.edit, ...p2.edit]
    return p
  }
}

module.exports = {
  FileObserver: FileObserver,
  DirectoryObserver: DirectoryObserver
}
