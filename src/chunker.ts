/**
 * Copyright (C) 2016 Threema GmbH / SaltyRTC Contributors
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the `LICENSE.md` file for details.
 */
/// <reference path="../chunked-dc.d.ts" />

import {Common} from "./common";

/**
 * A Chunker instance splits up an Uint8Array into multiple chunks.
 *
 * The Chunker is initialized with an ID. For each message to be chunked,
 * a new Chunker instance is required.
 */
export class Chunker implements chunkedDc.Chunker {

    private id: number;
    private chunkSize: number;
    private chunkId: number = 0;
    private message: Uint8Array;

    /**
     * Create a Chunker instance.
     *
     * @param id An identifier for the message. Must be between 0 and 2**32-1.
     * @param message The Uint8Array containing the bytes that should be chunked.
     * @param chunkSize The chunk size *excluding* header data.
     */
    constructor(id: number, message: Uint8Array, chunkSize: number) {
        if (chunkSize < 1) {
            throw new Error("Chunk size must be at least 1");
        }
        if (message.byteLength < 1) {
            throw new Error("Array may not be empty");
        }
        if (id < 0 || id >= 2**32) {
            throw new Error("Message id must be between 0 and 2**32-1");
        }
        this.id = id;
        this.message = message;
        this.chunkSize = chunkSize;
    }

    /**
     * Whether there are more chunks available.
     */
    public get hasNext(): boolean {
        const currentIndex = this.chunkId * this.chunkSize;
        const remaining = this.message.byteLength - currentIndex;
        return remaining >= 1;
    }

    /**
     * Iterator implementation. Value is the next Uint8Array chunk.
     */
    public next(): IteratorResult<Uint8Array> {
        if (!this.hasNext) {
            return {
                done: true
            };
        }

        // Allocate chunk buffer
        const currentIndex = this.chunkId * this.chunkSize;
        const remaining = this.message.byteLength - currentIndex;
        const chunkBytes = remaining < this.chunkSize ? remaining : this.chunkSize;
        const chunk = new DataView(new ArrayBuffer(chunkBytes + Common.HEADER_LENGTH));

        // Create header
        const options = remaining > chunkBytes ? 0 : 1;
        const id = this.id;
        const serial = this.nextSerial();

        // Write to chunk buffer
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

    /**
     * Return and post-increment the id of the next block
     */
    private nextSerial(): number {
        return this.chunkId++;
    }

    /**
     * Return an iterator over the chunks.
     */
    public [Symbol.iterator](): IterableIterator<Uint8Array> {
        return this;
    }

}
