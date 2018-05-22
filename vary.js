const XXHash = require('xxhash');
const fs = require('fs');
const EventEmitter = require('events');
const path = require('path');

var hashes = {};

module.exports = class VaryWatcher extends EventEmitter{
  constructor(automatic) {
    super();
    if(automatic === undefined) {automatic = true}
    if(automatic) {setInterval(this.vary, 1000);}
  }

  addFile(file) {
    hashes[file] = "";
    console.log("added " + file);
  }

  removeFile(file) {
    delete hashes[file];
    console.log("removed " + file);
  }

  vary() {
    for(var file in hashes) {
      var hasher = new XXHash(0xCAFEBABE);
      fs.createReadStream(file)
        .on('data', function(data) {
          hasher.update(data);
        })
        .on('end', function() {
          var hash = hasher.digest();
          if(hashes[file] != hash){
            hashes[file] = hash;
            this.emit('change', file);
          }
        });
    }
  }
}
