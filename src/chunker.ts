/**
 * Copyright (C) 2016-2018 Threema GmbH / SaltyRTC Contributors
 *
 * Licensed under the Apache License, Version 2.0, <see LICENSE-APACHE file>
 * or the MIT license <see LICENSE-MIT file>, at your option. This file may not be
 * copied, modified, or distributed except according to those terms.
 */
/// <reference path='../chunked-dc.d.ts' />

import { Common } from './common';

/**
 * A Chunker instance splits up an Uint8Array into multiple chunks.
 *
 * The Chunker is initialized with an ID. For each message to be chunked,
 * a new Chunker instance is required.
 */
export class Chunker implements chunkedDc.Chunker {

    private id: number;
    private chunkDataSize: number;
    private chunkId: number = 0;
    private message: Uint8Array;

    /**
     * Create a Chunker instance.
     *
     * @param id An identifier for the message. Must be between 0 and 2**32-1.
     * @param message The Uint8Array containing the bytes that should be chunked.
     * @param chunkSize The chunk size *including* header data.
     */
    constructor(id: number, message: Uint8Array, chunkSize: number) {
        if (chunkSize < (Common.HEADER_LENGTH + 1)) {
            throw new Error('Chunk size must be at least ' + (Common.HEADER_LENGTH + 1));
        }
        if (message.byteLength < 1) {
            throw new Error('Array may not be empty');
        }
        if (id < 0 || id >= (2 ** 32)) {
            throw new Error('Message id must be between 0 and 2**32-1');
        }
        this.id = id;
        this.message = message;
        this.chunkDataSize = chunkSize - Common.HEADER_LENGTH;
    }

    /**
     * Whether there are more chunks available.
     */
    public get hasNext(): boolean {
        const currentIndex = this.chunkId * this.chunkDataSize;
        const remaining = this.message.byteLength - currentIndex;
        return remaining >= 1;
    }

    /**
     * Iterator implementation. Value is the next Uint8Array chunk.
     */
    public next(): IteratorResult<Uint8Array> {
        if (!this.hasNext) {
            return {
                done: true,
                value: null,
            };
        }

        // Allocate chunk buffer
        const currentIndex = this.chunkId * this.chunkDataSize;
        const remaining = this.message.byteLength - currentIndex;
        const chunkBytes = remaining < this.chunkDataSize ? remaining : this.chunkDataSize;
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
            value: new Uint8Array(chunk.buffer),
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
