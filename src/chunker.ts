/**
 * Copyright (C) 2016-2019 Threema GmbH / SaltyRTC Contributors
 *
 * Licensed under the Apache License, Version 2.0, <see LICENSE-APACHE file>
 * or the MIT license <see LICENSE-MIT file>, at your option. This file may not be
 * copied, modified, or distributed except according to those terms.
 */
/// <reference path='../chunked-dc.d.ts' />

import { Mode, RELIABLE_ORDERED_HEADER_LENGTH, UNRELIABLE_UNORDERED_HEADER_LENGTH } from './common';

/**
 * A chunker fragments a single message into multiple chunks.
 *
 * For each message to be chunked, a new instance is required.
 */
abstract class AbstractChunker implements chunkedDc.Chunker {
    private readonly mode: Mode;
    private readonly id: number | null;
    private readonly message: Uint8Array;
    private readonly headerLength: number;
    private readonly payloadLength: number;
    private readonly buffer: ArrayBuffer | null;
    private offset: number = 0;
    private serial: number = 0;

    /**
     * Create a chunker for a specific mode.
     */
    protected constructor(
        mode: Mode, headerLength: number, id: number | null, message: Uint8Array, chunkLength: number,
        buffer: ArrayBuffer = null,
    ) {
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
        if (id != null && (id < 0 || id >= (2 ** 32))) {
            throw new Error('Message id must be between 0 and 2**32-1');
        }

        this.mode = mode;
        this.id = id;
        this.message = message;
        this.headerLength = headerLength;
        this.payloadLength = chunkLength - headerLength;
        this.buffer = buffer;
    }

    /**
     * Whether there are more chunks available.
     */
    public get hasNext(): boolean {
        return this.offset < this.message.byteLength;
    }

    /**
     * Iterator implementation. Value is the next Uint8Array chunk.
     *
     * Important: When the chunker has been created with an `ArrayBuffer`,
     *            the underlying buffer of the chunk will be reused in the next
     *            iteration.
     */
    public next(): IteratorResult<Uint8Array> {
        if (!this.hasNext) {
            return {
                done: true,
                value: null,
            };
        }

        // Allocate chunk buffer (if required)
        const remaining = this.message.byteLength - this.offset;
        const payloadLength = remaining < this.payloadLength ? remaining : this.payloadLength;
        const chunkLength = this.headerLength + payloadLength;
        const endOffset = this.offset + payloadLength;
        let chunkBuffer: ArrayBuffer;
        if (this.buffer !== null) {
            chunkBuffer = this.buffer;
        } else {
            chunkBuffer = new ArrayBuffer(chunkLength);
        }

        // Set header
        const chunkView = new DataView(chunkBuffer);
        let options: number = this.mode;
        if (endOffset === this.message.byteLength) {
            options |= 1; // tslint:disable-line:no-bitwise
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

        // Set payload
        const payloadSlice = this.message.subarray(this.offset, endOffset);
        const chunkArray = new Uint8Array(chunkBuffer, 0, chunkLength);
        chunkArray.set(payloadSlice, this.headerLength);
        this.offset = endOffset;
        return {
            done: false,
            value: chunkArray,
        };
    }

    /**
     * Return an iterator over the chunks.
     */
    public [Symbol.iterator](): IterableIterator<Uint8Array> {
        return this;
    }
}

export class ReliableOrderedChunker extends AbstractChunker implements chunkedDc.ReliableOrderedChunker {
    /**
     * Create a chunker for reliable & ordered mode.
     *
     * @param message The Uint8Array containing the bytes that should be chunked.
     * @param chunkLength The chunk size *including* header data.
     * @param buffer A chunk buffer to be used for handing out chunks. Must be
     *   able to at least contain `chunkLength` bytes. A new buffer will be
     *   created for every chunk if not supplied.
     * @throws Error if a chunk would not fit into the specified chunk length,
     *   if the message is empty, and if the message id is too large.
     */
    public constructor(message: Uint8Array, chunkLength: number, buffer?: ArrayBuffer) {
        super(Mode.ReliableOrdered, RELIABLE_ORDERED_HEADER_LENGTH, null, message, chunkLength, buffer);
    }
}

export class UnreliableUnorderedChunker extends AbstractChunker implements chunkedDc.UnreliableUnorderedChunker {
    /**
     * Create a chunker for reliable & ordered mode.
     *
     * @param id An identifier for the message. Must be between 0 and 2**32-1.
     * @param message The Uint8Array containing the bytes that should be chunked.
     * @param chunkLength The chunk size *including* header data.
     * @param buffer A chunk buffer to be used for handing out chunks. Must be
     *   able to at least contain `chunkLength` bytes. A new buffer will be
     *   created for every chunk if not supplied.
     * @throws Error if a chunk would not fit into the specified chunk length,
     *   if the message is empty, and if the message id is too large.
     */
    public constructor(id: number, message: Uint8Array, chunkLength: number, buffer?: ArrayBuffer) {
        super(Mode.UnreliableUnordered, UNRELIABLE_UNORDERED_HEADER_LENGTH, id, message, chunkLength, buffer);
    }
}
