/**
 * chunked-dc v1.0.0
 * Binary chunking for WebRTC data channels & more.
 * https://github.com/saltyrtc/chunked-dc-js#readme
 *
 * Copyright (C) 2016 Threema GmbH
 *
 * Licensed under the Apache License, Version 2.0, <see LICENSE-APACHE file>
 * or the MIT license <see LICENSE-MIT file>, at your option. This file may not be
 * copied, modified, or distributed except according to those terms.
 */

class Common {
}
Common.HEADER_LENGTH = 9;

class Chunker {
    constructor(id, message, chunkSize) {
        this.chunkId = 0;
        if (chunkSize < (Common.HEADER_LENGTH + 1)) {
            throw new Error("Chunk size must be at least " + (Common.HEADER_LENGTH + 1));
        }
        if (message.byteLength < 1) {
            throw new Error("Array may not be empty");
        }
        if (id < 0 || id >= Math.pow(2, 32)) {
            throw new Error("Message id must be between 0 and 2**32-1");
        }
        this.id = id;
        this.message = message;
        this.chunkDataSize = chunkSize - Common.HEADER_LENGTH;
    }
    get hasNext() {
        const currentIndex = this.chunkId * this.chunkDataSize;
        const remaining = this.message.byteLength - currentIndex;
        return remaining >= 1;
    }
    next() {
        if (!this.hasNext) {
            return {
                done: true,
                value: null
            };
        }
        const currentIndex = this.chunkId * this.chunkDataSize;
        const remaining = this.message.byteLength - currentIndex;
        const chunkBytes = remaining < this.chunkDataSize ? remaining : this.chunkDataSize;
        const chunk = new DataView(new ArrayBuffer(chunkBytes + Common.HEADER_LENGTH));
        const options = remaining > chunkBytes ? 0 : 1;
        const id = this.id;
        const serial = this.nextSerial();
        chunk.setUint8(0, options);
        chunk.setUint32(1, id);
        chunk.setUint32(5, serial);
        for (let i = 0; i < chunkBytes; i++) {
            const offset = Common.HEADER_LENGTH + i;
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

class Chunk {
    constructor(buf, context) {
        if (buf.byteLength < Common.HEADER_LENGTH) {
            throw new Error('Invalid chunk: Too short');
        }
        const reader = new DataView(buf);
        const options = reader.getUint8(0);
        this._endOfMessage = (options & 0x01) == 1;
        this._id = reader.getUint32(1);
        this._serial = reader.getUint32(5);
        this._data = new Uint8Array(buf.slice(Common.HEADER_LENGTH));
        this._context = context;
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
    get context() {
        return this._context;
    }
}
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
        const contextList = [];
        for (let chunk of this.chunks) {
            if (chunk.data.byteLength > firstSize) {
                throw new Error('No chunk may be larger than the first chunk of that message.');
            }
            buf.set(chunk.data, offset);
            offset += chunk.data.length;
            if (chunk.context !== undefined) {
                contextList.push(chunk.context);
            }
        }
        return {
            message: buf.slice(0, offset),
            context: contextList,
        };
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
    add(buf, context) {
        const chunk = new Chunk(buf, context);
        if (this.chunks.has(chunk.id) && this.chunks.get(chunk.id).hasSerial(chunk.serial)) {
            return;
        }
        if (chunk.isEndOfMessage && chunk.serial == 0) {
            this.notifyListener(chunk.data, context === undefined ? [] : [context]);
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
            const merged = collector.merge();
            this.notifyListener(merged.message, merged.context);
            this.chunks.delete(chunk.id);
        }
    }
    notifyListener(message, context) {
        if (this.onMessage != null) {
            this.onMessage(message, context);
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

export { Chunker, Unchunker };
