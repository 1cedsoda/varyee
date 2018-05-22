
VaryEE
===========
**vary event emitter**

Emitts an event if a linked file's content has changed.
**Live reload you config files.**

Install
============

    npm i varyee
    
Update
============

    npm update varyee
    
Usage
========
* Import VaryEE.
```javascript
const VaryEE = require('varyee');
```
* VaryEE checks every second if "package.conf" changes its content and emitts 'vary'.
```javascript
var vee = new VaryEE();
vee.addFile("package.conf");
```
* VaryEE checks "package.conf" only when vee2.vary() is triggered.
```javascript
var vee = new VaryEE(false);   //true is default
vee.addFile("package.conf");
vee.vary();                    //check manually
```
* Unlik a file. It will not be checked in future.
```javascript
vee.removeFile("package.conf");
```
* Capture the event.
```javascript
vee.on('vary', (file) => {
    console.log("The content of " + file + " has changed.");
});
```
