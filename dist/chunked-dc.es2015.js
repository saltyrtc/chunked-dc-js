/**
 * chunked-dc v1.0.0
 * Binary chunking for WebRTC data channels & more.
 * https://github.com/saltyrtc/chunked-dc-js#readme
 *
 * Copyright (C) 2017 Threema GmbH
 *
 * Licensed under the Apache License, Version 2.0, <see LICENSE-APACHE file>
 * or the MIT license <see LICENSE-MIT file>, at your option. This file may not be
 * copied, modified, or distributed except according to those terms.
 */

function __awaiter(thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
}

class Common {
}
Common.HEADER_LENGTH = 9;

class Chunker {
    constructor(id, message, chunkSize) {
        this.chunkId = 0;
        if (chunkSize < (Common.HEADER_LENGTH + 1)) {
            throw new Error("Chunk size must be at least " + (Common.HEADER_LENGTH + 1));
        }
        const length = this.getLength(message);
        if (length < 1) {
            throw new Error("Message may not be empty");
        }
        if (id < 0 || id >= Math.pow(2, 32)) {
            throw new Error("Message id must be between 0 and 2**32-1");
        }
        this.id = id;
        this.message = message;
        this.messageLength = length;
        this.chunkDataSize = chunkSize - Common.HEADER_LENGTH;
    }
    get hasNext() {
        const currentIndex = this.chunkId * this.chunkDataSize;
        const remaining = this.messageLength - currentIndex;
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
        const remaining = this.messageLength - currentIndex;
        const chunkBytes = remaining < this.chunkDataSize ? remaining : this.chunkDataSize;
        const options = remaining > chunkBytes ? 0 : 1;
        const chunk = this.getChunk(currentIndex, chunkBytes, options);
        return {
            done: false,
            value: chunk,
        };
    }
    nextSerial() {
        return this.chunkId++;
    }
    writeHeader(buffer, options) {
        const id = this.id;
        const serial = this.nextSerial();
        buffer.setUint8(0, options);
        buffer.setUint32(1, id);
        buffer.setUint32(5, serial);
    }
    [Symbol.iterator]() {
        return this;
    }
}
class BlobChunker extends Chunker {
    constructor(id, message, chunkSize) {
        super(id, message, chunkSize);
        this.headerBuffer = new DataView(new ArrayBuffer(Common.HEADER_LENGTH));
    }
    getLength(message) {
        return message.size;
    }
    getChunk(currentIndex, chunkBytes, options) {
        const chunk = this.message.slice(currentIndex, currentIndex + chunkBytes);
        this.writeHeader(this.headerBuffer, options);
        return new Blob([this.headerBuffer, chunk]);
    }
}
class Uint8ArrayChunker extends Chunker {
    getLength(message) {
        return message.byteLength;
    }
    getChunk(currentIndex, chunkBytes, options) {
        const chunk = new DataView(new ArrayBuffer(chunkBytes + Common.HEADER_LENGTH));
        this.writeHeader(chunk, options);
        for (let i = 0; i < chunkBytes; i++) {
            const offset = Common.HEADER_LENGTH + i;
            chunk.setUint8(offset, this.message[currentIndex + i]);
        }
        return new Uint8Array(chunk.buffer);
    }
}

class Chunk {
    constructor(buf, length, context) {
        if (length < Common.HEADER_LENGTH) {
            throw new Error('Invalid chunk: Too short');
        }
        this._length = length;
        this._data = this.getData(buf);
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
    readHeader(reader) {
        const options = reader.getUint8(0);
        this._endOfMessage = (options & 0x01) == 1;
        this._id = reader.getUint32(1);
        this._serial = reader.getUint32(5);
    }
}
class BlobChunk extends Chunk {
    getData(buf) {
        const [header, data] = buf;
        this.readHeader(new DataView(header));
        return data;
    }
}
class Uint8ArrayChunk extends Chunk {
    getData(buf) {
        this.readHeader(new DataView(buf));
        return new Uint8Array(buf.slice(Common.HEADER_LENGTH));
    }
}
function createChunk(buf, context) {
    return __awaiter(this, void 0, void 0, function* () {
        if (buf instanceof Blob) {
            const length = buf.size;
            if (length < Common.HEADER_LENGTH) {
                throw new Error('Invalid chunk: Too short');
            }
            const reader = new FileReader();
            const headerBlob = buf.slice(0, Common.HEADER_LENGTH);
            const headerBuf = yield new Promise((resolve, reject) => {
                reader.onload = () => {
                    resolve(reader.result);
                };
                reader.onerror = () => {
                    reject('Unable to read header from Blob');
                };
                reader.readAsArrayBuffer(headerBlob);
            });
            return new BlobChunk([headerBuf, buf.slice(Common.HEADER_LENGTH)], buf.size, context);
        }
        else if (buf instanceof Uint8Array) {
            return new Uint8ArrayChunk(buf.buffer, buf.byteLength, context);
        }
        else if (buf instanceof ArrayBuffer) {
            return new Uint8ArrayChunk(buf, buf.byteLength, context);
        }
        else {
            throw TypeError('Cannot create chunk from type ' + typeof buf);
        }
    });
}
class ChunkCollector {
    constructor() {
        this.lastUpdate = new Date().getTime();
        this.messageLength = null;
        this.chunks = [];
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
        return this.mergeChunks();
    }
    isOlderThan(maxAge) {
        const age = (new Date().getTime() - this.lastUpdate);
        return age > maxAge;
    }
    get chunkCount() {
        return this.chunks.length;
    }
}
class BlobChunkCollector extends ChunkCollector {
    mergeChunks() {
        const firstSize = this.chunks[0].data.size;
        const contextList = [];
        const dataList = this.chunks.map((chunk) => {
            if (chunk.data.size > firstSize) {
                throw new Error('No chunk may be larger than the first chunk of that message.');
            }
            if (chunk.context !== undefined) {
                contextList.push(chunk.context);
            }
            return chunk.data;
        });
        return {
            message: new Blob(dataList),
            context: contextList,
        };
    }
}
class Uint8ArrayChunkCollector extends ChunkCollector {
    mergeChunks() {
        const capacity = this.chunks[0].data.byteLength * this.messageLength;
        const buf = new Uint8Array(new ArrayBuffer(capacity));
        let offset = 0;
        const firstSize = this.chunks[0].data.byteLength;
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
}
class Unchunker {
    constructor() {
        this.chunks = new Map();
        this.onMessage = null;
    }
    add(buf, context) {
        return __awaiter(this, void 0, void 0, function* () {
            const chunk = yield createChunk(buf, context);
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
                collector = this.createChunkCollector();
                this.chunks.set(chunk.id, collector);
            }
            collector.addChunk(chunk);
            if (collector.isComplete) {
                const merged = collector.merge();
                this.notifyListener(merged.message, merged.context);
                this.chunks.delete(chunk.id);
            }
        });
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
class BlobUnchunker extends Unchunker {
    constructor() {
        super(...arguments);
        this.onMessage = null;
    }
    createChunkCollector() {
        return new BlobChunkCollector();
    }
}
class Uint8ArrayUnchunker extends Unchunker {
    constructor() {
        super(...arguments);
        this.onMessage = null;
    }
    createChunkCollector() {
        return new Uint8ArrayChunkCollector();
    }
}

export { Chunker, BlobChunker, Uint8ArrayChunker, Unchunker, BlobUnchunker, Uint8ArrayUnchunker };
