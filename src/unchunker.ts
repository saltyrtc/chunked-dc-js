/**
 * Copyright (C) 2016 Threema GmbH / SaltyRTC Contributors
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the `LICENSE.md` file for details.
 */
/// <reference path="../chunked-dc.d.ts" />

import {Common} from "./common";

/**
 * Helper class to access chunk information.
 */
export class Chunk {
    private _endOfMessage: boolean;
    private _id: number;
    private _serial: number;
    private _data: Uint8Array;

    /**
     * Parse the ArrayBuffer.
     */
    constructor(buf: ArrayBuffer) {
        if (buf.byteLength < Common.HEADER_LENGTH) {
            throw new Error('Invalid chunk: Too short');
        }

        // Read header
        const reader = new DataView(buf);
        const config = reader.getUint8(0);
        this._endOfMessage = (config & 0x01) == 1;
        this._id = reader.getUint32(1);
        this._serial = reader.getUint32(5);

        // Read data
        // Note: We copy the data bytes instead of getting a reference to a subset of the buffer.
        // This is less ideal for performance, but avoids bugs that can occur
        // by 3rd party modification of the ArrayBuffer.
        this._data = new Uint8Array(buf.slice(Common.HEADER_LENGTH));
    }

    public get isEndOfMessage(): boolean {
        return this._endOfMessage;
    }

    public get id(): number {
        return this._id;
    }

    public get serial(): number {
        return this._serial;
    }

    public get data(): Uint8Array {
        return this._data;
    }
}

/**
 * Helper class to hold chunks and an "end-arrived" flag.
 */
class ChunkCollector {
    private endArrived: boolean;
    private messageLength: number = null;
    private chunks: Chunk[] = [];
    private lastUpdate: number = new Date().getTime();

    /**
     * Register a new chunk. Return a boolean indicating whether the chunk was added.
     */
    public addChunk(chunk: Chunk): void {
        // Ignore repeated chunks with the same serial
        if (this.hasSerial(chunk.serial)) {
            return;
        }

        // Add chunk
        this.chunks.push(chunk);

        // Process chunk
        this.lastUpdate = new Date().getTime();
        if (chunk.isEndOfMessage) {
            this.endArrived = true;
            this.messageLength = chunk.serial + 1;
        }
    }

    /**
     * Return whether this chunk collector already contains a chunk with the specified serial.
     */
    public hasSerial(serial: number): boolean {
        return this.chunks.find(
            (chunk: Chunk) => chunk.serial == serial
        ) !== undefined;
    }

    /**
     * Return whether the message is complete, meaning that all chunks of the message arrived.
     */
    public get isComplete() {
        return this.endArrived && this.chunks.length == this.messageLength;
    }

    /**
     * Merge the messages.
     *
     * Note: This implementation assumes that no chunk will be larger than the first one!
     * If this is not the case, an error may be thrown.
     *
     * @return An `Uint8Array` containing the assembled message.
     * @throws Error if message is not yet complete.
     */
    public merge(): Uint8Array {
        // Preconditions
        if (!this.isComplete) {
            throw new Error('Not all chunks for this message have arrived yet.');
        }

        // Sort chunks
        this.chunks.sort((a: Chunk, b: Chunk) => {
            if (a.serial < b.serial) {
                return -1;
            } else if (a.serial > b.serial) {
                return 1;
            }
            return 0;
        });

        // Allocate buffer
        const capacity = this.chunks[0].data.byteLength * this.messageLength;
        const buf = new Uint8Array(new ArrayBuffer(capacity));

        // Add chunks to buffer
        let offset = 0;
        let firstSize = this.chunks[0].data.byteLength;
        for (let chunk of this.chunks) {
            if (chunk.data.byteLength > firstSize) {
                throw new Error('No chunk may be larger than the first chunk of that message.');
            }
            buf.set(chunk.data, offset);
            offset += chunk.data.length;
        }

        // Return array
        return buf.slice(0, offset);
    }

    /**
     * Return whether last chunk is older than the specified number of miliseconds.
     */
    public isOlderThan(maxAge: number): boolean {
        const age = (new Date().getTime() - this.lastUpdate);
        return age > maxAge;
    }
}

/**
 * An Unchunker instance merges multiple chunks into a single Uint8Array.
 *
 * It keeps track of IDs, so only one Unchunker instance is necessary
 * to receive multiple messages.
 */
export class Unchunker {
    private chunks: Map<number, ChunkCollector> = new Map();

    /**
     * Message listener. Set by the user.
     */
    public onMessage: (message: Uint8Array) => void = null;

    /**
     * Add a chunk.
     *
     * @param buf ArrayBuffer containing chunk with 9 byte header.
     * @throws Error if message is smaller than the header length.
     */
    public add(buf: ArrayBuffer): void {
        // Parse chunk
        const chunk = new Chunk(buf);

        // Ignore repeated chunks with the same serial
        if (this.chunks.has(chunk.id) && this.chunks.get(chunk.id).hasSerial(chunk.serial)) {
            return;
        }

        // If this is the only chunk in the message, return it immediately.
        if (chunk.isEndOfMessage && chunk.serial == 0) {
            this.notifyListener(chunk.data);
            this.chunks.delete(chunk.id);
            return;
        }

        // Otherwise, add chunk to chunks list
        let collector: ChunkCollector;
        if (this.chunks.has(chunk.id)) {
            collector = this.chunks.get(chunk.id);
        } else {
            collector = new ChunkCollector();
            this.chunks.set(chunk.id, collector);
        }
        collector.addChunk(chunk);

        // Check if message is complete
        if (collector.isComplete) {
            // Merge and notify listener...
            this.notifyListener(collector.merge());
            // ...then delete the chunks.
            this.chunks.delete(chunk.id);
        }
    }

    /**
     * If a message listener is set, notify it about a complete message.
     * @param message
     */
    private notifyListener(message: Uint8Array) {
        if (this.onMessage != null) {
            this.onMessage(message);
        }
    }

    // TODO: GC
}