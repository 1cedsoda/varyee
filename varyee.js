const XXHash = require('xxhash')
const fs = require('fs')
const EventEmitter = require('events')
const path = require('path')

class FileObserver extends EventEmitter {
  constructor(interval) {
    super()
    this.hashes = {}
    if (interval === undefined) { interval = 1000 }
    if (interval != 0 && !(interval == false)) {
      setInterval(this.check.bind(this), interval)
    }
  }

  addFile(file) {
    this.hashes[file] = ""
  }

  removeFile(file) {
    delete this.hashes[file]
  }

  check() {
    for (var file in this.hashes) {
      var hasher = new XXHash(0x1C3D50D4)
      fs.createReadStream(file)
        .on('data', function (data) {
          hasher.update(data)
        })
        .on('end', (function () {
            var hash = hasher.digest()
            if (this.hashes[file] != hash) {
              if (this.hashes[file] != "") {
                this.emit('vary', file)
              }
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
    this.changes = this.compare(this.base, this.vary)
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
    } catch (e) {
      this.emit('error', e)
    }
    return folder
  }

  checkpoint() { //update this.base
    this.base = this.hashtree(this.dir)
    this.vary = this.base
  }

  check() {
    this.vary = this.hashtree(this.dir)
    var newchanges = this.compare(this.base, this.vary)
    if (!(JSON.stringify(newchanges) === JSON.stringify(this.changes))) {
      this.emit('vary', newchanges)
    }
    this.changes = newchanges
  }

  compare(base, vary) {
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
        if (isDir) {
          protocol.delDir.push(key)
        } else {
          protocol.delFile.push(key)
        }
      } else {
        //directory wasnt removed? Maybe files init! -> recursion
        if (isDir) {
          var subprotocol = this.compare(base[key], vary[key]) //recursion into subsirectory
          protocol = this.mergeProtocols(protocol, subprotocol)
        }
      }
    }

    //added things
    for (var key in vary) {
      var isDir = typeof vary[key] === "object" // object is a foler ?
      if (!(key in base)) {
        if (isDir) {
          protocol.addDir.push(key)
          var subprotocol = this.compare(base[key], vary[key]) //recursion into subsirectory
          protocol = this.mergeProtocols(protocol, subprotocol)
        } else {
          protocol.addFile.push(key)
        }
      } else {
        //file is not vary ... but maybe edited?
        if (!isDir && base[key] != vary[key]) {
          protocol.edit.push(key)
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
