/**
 * chunked-dc v2.0.1
 * Binary chunking for WebRTC data channels & more.
 * https://github.com/saltyrtc/chunked-dc-js#readme
 *
 * Copyright (C) 2016-2019 Threema GmbH
 *
 * Licensed under the Apache License, Version 2.0, <see LICENSE-APACHE file>
 * or the MIT license <see LICENSE-MIT file>, at your option. This file may not be
 * copied, modified, or distributed except according to those terms.
 */

const RELIABLE_ORDERED_HEADER_LENGTH = 1;
const UNRELIABLE_UNORDERED_HEADER_LENGTH = 9;
const MODE_BITMASK = 6;
var Mode;
(function (Mode) {
    Mode[Mode["ReliableOrdered"] = 6] = "ReliableOrdered";
    Mode[Mode["UnreliableUnordered"] = 0] = "UnreliableUnordered";
})(Mode || (Mode = {}));

class AbstractChunker {
    constructor(mode, headerLength, id, message, chunkLength, buffer = null) {
        this.offset = 0;
        this.serial = 0;
        const minChunkSize = headerLength + 1;
        if (chunkLength < minChunkSize) {
            throw new Error(`Chunk size must be at least ${minChunkSize}`);
        }
        if (buffer !== null && buffer.byteLength < chunkLength) {
            throw new Error('Buffer too small for chunks');
        }
        if (message.byteLength < 1) {
            throw new Error('Message may not be empty');
        }
        if (id != null && (id < 0 || id >= (Math.pow(2, 32)))) {
            throw new Error('Message id must be between 0 and 2**32-1');
        }
        this.mode = mode;
        this.id = id;
        this.message = message;
        this.headerLength = headerLength;
        this.payloadLength = chunkLength - headerLength;
        this.buffer = buffer;
    }
    get hasNext() {
        return this.offset < this.message.byteLength;
    }
    next() {
        if (!this.hasNext) {
            return {
                done: true,
                value: null,
            };
        }
        const remaining = this.message.byteLength - this.offset;
        const payloadLength = remaining < this.payloadLength ? remaining : this.payloadLength;
        const chunkLength = this.headerLength + payloadLength;
        const endOffset = this.offset + payloadLength;
        let chunkBuffer;
        if (this.buffer !== null) {
            chunkBuffer = this.buffer;
        }
        else {
            chunkBuffer = new ArrayBuffer(chunkLength);
        }
        const chunkView = new DataView(chunkBuffer);
        let options = this.mode;
        if (endOffset === this.message.byteLength) {
            options |= 1;
        }
        chunkView.setUint8(0, options);
        switch (this.mode) {
            case Mode.ReliableOrdered:
                break;
            case Mode.UnreliableUnordered:
                chunkView.setUint32(1, this.id);
                chunkView.setUint32(5, this.serial++);
                break;
        }
        const payloadSlice = this.message.subarray(this.offset, endOffset);
        const chunkArray = new Uint8Array(chunkBuffer, 0, chunkLength);
        chunkArray.set(payloadSlice, this.headerLength);
        this.offset = endOffset;
        return {
            done: false,
            value: chunkArray,
        };
    }
    [Symbol.iterator]() {
        return this;
    }
}
class ReliableOrderedChunker extends AbstractChunker {
    constructor(message, chunkLength, buffer) {
        super(Mode.ReliableOrdered, RELIABLE_ORDERED_HEADER_LENGTH, null, message, chunkLength, buffer);
    }
}
class UnreliableUnorderedChunker extends AbstractChunker {
    constructor(id, message, chunkLength, buffer) {
        super(Mode.UnreliableUnordered, UNRELIABLE_UNORDERED_HEADER_LENGTH, id, message, chunkLength, buffer);
    }
}

class Chunk {
    constructor(chunkArray, expectedMode, headerLength) {
        if (chunkArray.byteLength < headerLength) {
            throw new Error('Invalid chunk: Too short');
        }
        const chunkView = new DataView(chunkArray.buffer, chunkArray.byteOffset, chunkArray.byteLength);
        const options = chunkView.getUint8(0);
        const actualMode = (options & MODE_BITMASK);
        if (actualMode !== expectedMode) {
            throw new Error(`Invalid chunk: Unexpected mode ${actualMode}`);
        }
        switch (expectedMode) {
            case Mode.ReliableOrdered:
                break;
            case Mode.UnreliableUnordered:
                this.id = chunkView.getUint32(1);
                this.serial = chunkView.getUint32(5);
                break;
        }
        this.endOfMessage = (options & 1) === 1;
        this.payload = chunkArray.subarray(headerLength);
    }
}
class ContiguousBufferReassembler {
    constructor(buffer = null) {
        this.complete = false;
        this.buffer = buffer;
        if (this.buffer !== null) {
            this.array = new Uint8Array(this.buffer);
            this.offset = 0;
            this.remaining = this.buffer.byteLength;
        }
        else {
            this.array = null;
            this.offset = 0;
            this.remaining = 0;
        }
    }
    get empty() {
        return this.offset === 0;
    }
    add(chunk) {
        if (this.complete) {
            throw new Error('Message already complete');
        }
        const chunkLength = chunk.payload.byteLength;
        this.maybeResize(chunkLength);
        this.complete = chunk.endOfMessage;
        this.array.set(chunk.payload, this.offset);
        this.offset += chunkLength;
        this.remaining -= chunkLength;
    }
    addBatched(chunks, totalByteLength) {
        this.maybeResize(totalByteLength);
        let chunk;
        for (chunk of chunks) {
            if (this.complete) {
                throw new Error('Message already complete');
            }
            this.complete = chunk.endOfMessage;
            this.array.set(chunk.payload, this.offset);
            this.offset += chunk.payload.byteLength;
        }
        this.remaining -= totalByteLength;
        return chunk;
    }
    maybeResize(requiredLength) {
        if (this.buffer === null) {
            this.buffer = new ArrayBuffer(requiredLength);
            this.array = new Uint8Array(this.buffer);
            return;
        }
        if (this.remaining < requiredLength) {
            const previousArray = this.array;
            const length = Math.max(previousArray.byteLength * 2, previousArray.byteLength + requiredLength);
            this.buffer = new ArrayBuffer(length);
            this.array = new Uint8Array(this.buffer);
            this.array.set(previousArray);
            this.remaining = length - this.offset;
        }
    }
    getMessage() {
        if (!this.complete) {
            throw new Error('Message not complete');
        }
        const message = this.array.subarray(0, this.offset);
        this.complete = false;
        this.offset = 0;
        this.remaining = this.buffer.byteLength;
        return message;
    }
}
class UnreliableUnorderedReassembler {
    constructor() {
        this.contiguousChunks = new ContiguousBufferReassembler();
        this.queuedChunks = null;
        this.queuedChunksTotalByteLength = 0;
        this._chunkCount = 0;
        this.nextOrderedSerial = 0;
        this.lastUpdate = new Date().getTime();
        this.requiredChunkCount = null;
    }
    get chunkCount() {
        return this._chunkCount;
    }
    get complete() {
        return this.requiredChunkCount !== null && this._chunkCount === this.requiredChunkCount;
    }
    add(chunk) {
        if (this.complete) {
            throw new Error('Message already complete');
        }
        if (this.queuedChunks === null && chunk.serial === this._chunkCount) {
            this.contiguousChunks.add(chunk);
            this.nextOrderedSerial = chunk.serial + 1;
        }
        else {
            const ready = this.queueUnorderedChunk(chunk);
            if (ready) {
                this.moveQueuedChunks();
            }
        }
        if (chunk.endOfMessage) {
            this.requiredChunkCount = chunk.serial + 1;
        }
        ++this._chunkCount;
        this.lastUpdate = new Date().getTime();
    }
    queueUnorderedChunk(chunk) {
        this.queuedChunksTotalByteLength += chunk.payload.byteLength;
        if (this.queuedChunks === null) {
            this.queuedChunks = [chunk];
            return false;
        }
        this.queuedChunks.push(chunk);
        this.queuedChunks.sort((a, b) => {
            if (a.serial < b.serial) {
                return -1;
            }
            if (a.serial > b.serial) {
                return 1;
            }
            return 0;
        });
        const iterator = this.queuedChunks.values();
        let previousChunk = iterator.next().value;
        if (previousChunk.serial !== this.nextOrderedSerial) {
            return false;
        }
        for (const currentChunk of iterator) {
            if (previousChunk.serial + 1 !== currentChunk.serial) {
                return false;
            }
            previousChunk = currentChunk;
        }
        return true;
    }
    moveQueuedChunks() {
        const chunk = this.contiguousChunks.addBatched(this.queuedChunks, this.queuedChunksTotalByteLength);
        this.nextOrderedSerial = chunk.serial + 1;
        this.queuedChunks = null;
    }
    getMessage() {
        if (!this.complete) {
            throw new Error('Message not complete');
        }
        return this.contiguousChunks.getMessage();
    }
    isOlderThan(maxAge) {
        const age = (new Date().getTime() - this.lastUpdate);
        return age > maxAge;
    }
}
class AbstractUnchunker {
    constructor() {
        this.onMessage = null;
    }
    notifyListener(message) {
        if (this.onMessage != null) {
            this.onMessage(message);
        }
    }
}
class ReliableOrderedUnchunker extends AbstractUnchunker {
    constructor(buffer) {
        super();
        this.reassembler = new ContiguousBufferReassembler(buffer);
    }
    add(chunkArray) {
        const chunk = new Chunk(chunkArray, Mode.ReliableOrdered, RELIABLE_ORDERED_HEADER_LENGTH);
        if (this.reassembler.empty && chunk.endOfMessage) {
            this.notifyListener(chunk.payload);
            return;
        }
        this.reassembler.add(chunk);
        if (chunk.endOfMessage) {
            this.notifyListener(this.reassembler.getMessage());
        }
    }
}
class UnreliableUnorderedUnchunker extends AbstractUnchunker {
    constructor() {
        super(...arguments);
        this.reassemblers = new Map();
    }
    add(chunkArray) {
        const chunk = new Chunk(chunkArray, Mode.UnreliableUnordered, UNRELIABLE_UNORDERED_HEADER_LENGTH);
        if (chunk.endOfMessage && chunk.serial === 0) {
            this.notifyListener(chunk.payload);
            return;
        }
        let reassembler = this.reassemblers.get(chunk.id);
        if (reassembler === undefined) {
            reassembler = new UnreliableUnorderedReassembler();
            this.reassemblers.set(chunk.id, reassembler);
        }
        reassembler.add(chunk);
        if (reassembler.complete) {
            this.notifyListener(reassembler.getMessage());
            this.reassemblers.delete(chunk.id);
        }
    }
    gc(maxAge) {
        let removed = 0;
        for (const [id, reassembler] of this.reassemblers) {
            if (reassembler.isOlderThan(maxAge)) {
                removed += reassembler.chunkCount;
                this.reassemblers.delete(id);
            }
        }
        return removed;
    }
}

export { UNRELIABLE_UNORDERED_HEADER_LENGTH, RELIABLE_ORDERED_HEADER_LENGTH, Mode, ReliableOrderedChunker, UnreliableUnorderedChunker, ReliableOrderedUnchunker, UnreliableUnorderedUnchunker };
//# sourceMappingURL=chunked-dc.es2015.js.map
