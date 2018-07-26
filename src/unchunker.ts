/**
 * Copyright (C) 2016-2018 Threema GmbH / SaltyRTC Contributors
 *
 * Licensed under the Apache License, Version 2.0, <see LICENSE-APACHE file>
 * or the MIT license <see LICENSE-MIT file>, at your option. This file may not be
 * copied, modified, or distributed except according to those terms.
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
    private _context: any;

    /**
     * Parse the ArrayBuffer.
     */
    constructor(buf: ArrayBuffer, context?: any) {
        if (buf.byteLength < Common.HEADER_LENGTH) {
            throw new Error('Invalid chunk: Too short');
        }

        // Read header
        const reader = new DataView(buf);
        const options = reader.getUint8(0);
        this._endOfMessage = (options & 0x01) == 1;
        this._id = reader.getUint32(1);
        this._serial = reader.getUint32(5);

        // Read data
        // Note: We copy the data bytes instead of getting a reference to a subset of the buffer.
        // This is less ideal for performance, but avoids bugs that can occur
        // by 3rd party modification of the ArrayBuffer.
        this._data = new Uint8Array(buf.slice(Common.HEADER_LENGTH));

        // Store context
        this._context = context;
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

    public get context(): any {
        return this._context;
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
     * @return An object containing the message as an `Uint8Array`
     *         and a (possibly empty) list of context objects.
     * @throws Error if message is not yet complete.
     */
    public merge(): {message: Uint8Array, context: any[]} {
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

        // Return result object
        return {
            message: buf.slice(0, offset),
            context: contextList,
        };
    }

    /**
     * Return whether last chunk is older than the specified number of miliseconds.
     */
    public isOlderThan(maxAge: number): boolean {
        const age = (new Date().getTime() - this.lastUpdate);
        return age > maxAge;
    }

    /**
     * Return the number of registered chunks.
     */
    public get chunkCount(): number {
        return this.chunks.length;
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
    public onMessage: (message: Uint8Array, context?: any[]) => void = null;

    /**
     * Add a chunk.
     *
     * @param buf ArrayBuffer containing chunk with 9 byte header.
     * @param context Arbitrary data that will be registered with the chunk and will be passed to the callback.
     * @throws Error if message is smaller than the header length.
     */
    public add(buf: ArrayBuffer, context?: any): void {
        // Parse chunk
        const chunk = new Chunk(buf, context);

        // Ignore repeated chunks with the same serial
        if (this.chunks.has(chunk.id) && this.chunks.get(chunk.id).hasSerial(chunk.serial)) {
            return;
        }

        // If this is the only chunk in the message, return it immediately.
        if (chunk.isEndOfMessage && chunk.serial == 0) {
            this.notifyListener(chunk.data, context === undefined ? [] : [context]);
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
            const merged = collector.merge();
            this.notifyListener(merged.message, merged.context);
            // ...then delete the chunks.
            this.chunks.delete(chunk.id);
        }
    }

    /**
     * If a message listener is set, notify it about a complete message.
     */
    private notifyListener(message: Uint8Array, context: any[]) {
        if (this.onMessage != null) {
            this.onMessage(message, context);
        }
    }

    /**
     * Run garbage collection, remove incomplete messages that haven't been
     * updated for more than the specified number of milliseconds.
     *
     * If you want to make sure that invalid chunks don't fill up memory, call
     * this method regularly.
     *
     * @param maxAge Remove incomplete messages that haven't been updated for
     *               more than the specified number of milliseconds.
     * @return the number of removed chunks.
     */
    public gc(maxAge: number): number {
        let removedItems = 0;
        for (let entry of this.chunks) {
            const msgId: number = entry[0];
            const collector: ChunkCollector = entry[1];
            if (collector.isOlderThan(maxAge)) {
                removedItems += collector.chunkCount;
                this.chunks.delete(msgId);
            }
        }
        return removedItems;
    }
}
