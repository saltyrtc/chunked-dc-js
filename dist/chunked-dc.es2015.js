/*
** chunked-dc-js version 0.1.0 (2016-09-05).
**
** https://github.com/saltyrtc/chunked-dc-js
**
** Copyright (C) 2016 Threema GmbH / SaltyRTC Contributors
**
** Licensed under the Apache License, Version 2.0, <see LICENSE-APACHE file>
** or the MIT license <see LICENSE-MIT file>, at your option. This file may not be
** copied, modified, or distributed except according to those terms.
*/

(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.chunkedDc = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";
const common_1 = require("./common");
class Chunker {
    constructor(id, message, chunkSize) {
        this.chunkId = 0;
        if (chunkSize < 1) {
            throw new Error("Chunk size must be at least 1");
        }
        if (message.byteLength < 1) {
            throw new Error("Array may not be empty");
        }
        if (id < 0 || id >= Math.pow(2, 32)) {
            throw new Error("Message id must be between 0 and 2**32-1");
        }
        this.id = id;
        this.message = message;
        this.chunkSize = chunkSize;
    }
    get hasNext() {
        const currentIndex = this.chunkId * this.chunkSize;
        const remaining = this.message.byteLength - currentIndex;
        return remaining >= 1;
    }
    next() {
        if (!this.hasNext) {
            return {
                done: true
            };
        }
        const currentIndex = this.chunkId * this.chunkSize;
        const remaining = this.message.byteLength - currentIndex;
        const chunkBytes = remaining < this.chunkSize ? remaining : this.chunkSize;
        const chunk = new DataView(new ArrayBuffer(chunkBytes + common_1.Common.HEADER_LENGTH));
        const options = remaining > chunkBytes ? 0 : 1;
        const id = this.id;
        const serial = this.nextSerial();
        chunk.setUint8(0, options);
        chunk.setUint32(1, id);
        chunk.setUint32(5, serial);
        for (let i = 0; i < chunkBytes; i++) {
            const offset = common_1.Common.HEADER_LENGTH + i;
            chunk.setUint8(offset, this.message[currentIndex + i]);
        }
        return {
            done: false,
            value: new Uint8Array(chunk.buffer)
        };
    }
    nextSerial() {
        return this.chunkId++;
    }
    [Symbol.iterator]() {
        return this;
    }
}
exports.Chunker = Chunker;

},{"./common":2}],2:[function(require,module,exports){
"use strict";
class Common {
}
Common.HEADER_LENGTH = 9;
exports.Common = Common;

},{}],3:[function(require,module,exports){
"use strict";
var chunker_1 = require("./chunker");
exports.Chunker = chunker_1.Chunker;
var unchunker_1 = require("./unchunker");
exports.Unchunker = unchunker_1.Unchunker;

},{"./chunker":1,"./unchunker":4}],4:[function(require,module,exports){
"use strict";
const common_1 = require("./common");
class Chunk {
    constructor(buf) {
        if (buf.byteLength < common_1.Common.HEADER_LENGTH) {
            throw new Error('Invalid chunk: Too short');
        }
        const reader = new DataView(buf);
        const options = reader.getUint8(0);
        this._endOfMessage = (options & 0x01) == 1;
        this._id = reader.getUint32(1);
        this._serial = reader.getUint32(5);
        this._data = new Uint8Array(buf.slice(common_1.Common.HEADER_LENGTH));
    }
    get isEndOfMessage() {
        return this._endOfMessage;
    }
    get id() {
        return this._id;
    }
    get serial() {
        return this._serial;
    }
    get data() {
        return this._data;
    }
}
exports.Chunk = Chunk;
class ChunkCollector {
    constructor() {
        this.messageLength = null;
        this.chunks = [];
        this.lastUpdate = new Date().getTime();
    }
    addChunk(chunk) {
        if (this.hasSerial(chunk.serial)) {
            return;
        }
        this.chunks.push(chunk);
        this.lastUpdate = new Date().getTime();
        if (chunk.isEndOfMessage) {
            this.endArrived = true;
            this.messageLength = chunk.serial + 1;
        }
    }
    hasSerial(serial) {
        return this.chunks.find((chunk) => chunk.serial == serial) !== undefined;
    }
    get isComplete() {
        return this.endArrived && this.chunks.length == this.messageLength;
    }
    merge() {
        if (!this.isComplete) {
            throw new Error('Not all chunks for this message have arrived yet.');
        }
        this.chunks.sort((a, b) => {
            if (a.serial < b.serial) {
                return -1;
            }
            else if (a.serial > b.serial) {
                return 1;
            }
            return 0;
        });
        const capacity = this.chunks[0].data.byteLength * this.messageLength;
        const buf = new Uint8Array(new ArrayBuffer(capacity));
        let offset = 0;
        let firstSize = this.chunks[0].data.byteLength;
        for (let chunk of this.chunks) {
            if (chunk.data.byteLength > firstSize) {
                throw new Error('No chunk may be larger than the first chunk of that message.');
            }
            buf.set(chunk.data, offset);
            offset += chunk.data.length;
        }
        return buf.slice(0, offset);
    }
    isOlderThan(maxAge) {
        const age = (new Date().getTime() - this.lastUpdate);
        return age > maxAge;
    }
    get chunkCount() {
        return this.chunks.length;
    }
}
class Unchunker {
    constructor() {
        this.chunks = new Map();
        this.onMessage = null;
    }
    add(buf) {
        const chunk = new Chunk(buf);
        if (this.chunks.has(chunk.id) && this.chunks.get(chunk.id).hasSerial(chunk.serial)) {
            return;
        }
        if (chunk.isEndOfMessage && chunk.serial == 0) {
            this.notifyListener(chunk.data);
            this.chunks.delete(chunk.id);
            return;
        }
        let collector;
        if (this.chunks.has(chunk.id)) {
            collector = this.chunks.get(chunk.id);
        }
        else {
            collector = new ChunkCollector();
            this.chunks.set(chunk.id, collector);
        }
        collector.addChunk(chunk);
        if (collector.isComplete) {
            this.notifyListener(collector.merge());
            this.chunks.delete(chunk.id);
        }
    }
    notifyListener(message) {
        if (this.onMessage != null) {
            this.onMessage(message);
        }
    }
    gc(maxAge) {
        let removedItems = 0;
        for (let entry of this.chunks) {
            const msgId = entry[0];
            const collector = entry[1];
            if (collector.isOlderThan(maxAge)) {
                removedItems += collector.chunkCount;
                this.chunks.delete(msgId);
            }
        }
        return removedItems;
    }
}
exports.Unchunker = Unchunker;

},{"./common":2}]},{},[3])(3)
});