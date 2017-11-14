/**
 * Copyright (C) 2017 Threema GmbH / SaltyRTC Contributors
 *
 * Licensed under the Apache License, Version 2.0, <see LICENSE-APACHE file>
 * or the MIT license <see LICENSE-MIT file>, at your option. This file may not be
 * copied, modified, or distributed except according to those terms.
 */
/// <reference path="../chunked-dc.d.ts" />

import {Common} from "./common";

/**
 * A Chunker instance splits up a source of data into multiple chunks.
 *
 * The Chunker is initialized with an ID. For each message to be chunked,
 * a new Chunker instance is required.
 */
export abstract class Chunker {
    private id: number;
    private chunkDataSize: number;
    private chunkId: number = 0;
    protected message: any;
    protected messageLength: number;

    /**
     * Create a Chunker instance.
     *
     * @param id An identifier for the message. Must be between 0 and 2**32-1.
     * @param message The message containing the bytes that should be chunked.
     * @param chunkSize The chunk size *including* header data.
     */
    constructor(id: number, message: any, chunkSize: number) {
        if (chunkSize < (Common.HEADER_LENGTH + 1)) {
            throw new Error("Chunk size must be at least " + (Common.HEADER_LENGTH + 1));
        }
        const length = this.getLength(message);
        if (length < 1) {
            throw new Error("Message may not be empty");
        }
        if (id < 0 || id >= 2**32) {
            throw new Error("Message id must be between 0 and 2**32-1");
        }
        this.id = id;
        this.message = message;
        this.messageLength = length;
        this.chunkDataSize = chunkSize - Common.HEADER_LENGTH;
    }

    /**
     * Whether there are more chunks available.
     */
    public get hasNext(): boolean {
        const currentIndex = this.chunkId * this.chunkDataSize;
        const remaining = this.messageLength - currentIndex;
        return remaining >= 1;
    }

    /**
     * Iterator implementation. Value is the next chunk.
     */
    public next(): IteratorResult<any> {
        if (!this.hasNext) {
            return {
                done: true,
                value: null
            };
        }

        // Get chunk
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

    /**
     * Return and post-increment the id of the next block
     */
    private nextSerial(): number {
        return this.chunkId++;
    }

    /**
     * Get length of the message.
     *
     * @param message The message to be chunked.
     * @returns The message's length.
     */
    protected abstract getLength(message: any): number;

    /**
     * Write and return a chunk.
     * Important: You must add the header yourselves! Call writeHeader for that purpose.
     *
     * @param currentIndex The current index in the message.
     * @param chunkBytes Amount of bytes to be chunked.
     * @param options The options bit field.
     */
    protected abstract getChunk(currentIndex: number, chunkBytes: number, options: number): any;

    /**
     * Write header to a DataView.
     *
     * @param buffer The buffer to write the header to.
     * @param options The options bit field.
     */
    protected writeHeader(buffer: DataView, options: number) {
        const id = this.id;
        const serial = this.nextSerial();

        // Write header
        buffer.setUint8(0, options);
        buffer.setUint32(1, id);
        buffer.setUint32(5, serial);
    }

    /**
     * Return an iterator over the chunks.
     */
    public [Symbol.iterator](): IterableIterator<any> {
        return this;
    }
}

/**
 * A BlobChunker instance splits up a Blob into multiple chunks of that Blob.
 *
 * The BlobChunker is initialized with an ID. For each message to be chunked,
 * a new BlobChunker instance is required.
 */
export class BlobChunker extends Chunker implements chunkedDc.BlobChunker {
    private headerBuffer: DataView;

    constructor(id: number, message: any, chunkSize: number) {
        super(id, message, chunkSize);
        // Allocate header buffer
        this.headerBuffer = new DataView(new ArrayBuffer(Common.HEADER_LENGTH));
    }

    protected getLength(message: Blob): number {
        return message.size;
    }

    protected getChunk(currentIndex: number, chunkBytes: number, options: number): Blob {
        // Slice chunk out of message
        const chunk = this.message.slice(currentIndex, currentIndex + chunkBytes);
        // Write header
        this.writeHeader(this.headerBuffer, options);
        // Join header and chunk
        return new Blob([this.headerBuffer, chunk]);
    }
}

/**
 * A Uint8ArrayChunker instance splits up a Blob into multiple chunks of that Uint8Array.
 *
 * The Uint8ArrayChunker is initialized with an ID. For each message to be chunked,
 * a new Uint8ArrayChunker instance is required.
 */
export class Uint8ArrayChunker extends Chunker implements chunkedDc.Uint8ArrayChunker {
    protected getLength(message: Uint8Array): number {
        return message.byteLength;
    }

    protected getChunk(currentIndex: number, chunkBytes: number, options: number): any {
        // Allocate chunk buffer
        const chunk = new DataView(new ArrayBuffer(chunkBytes + Common.HEADER_LENGTH));
        // Write header to chunk buffer
        this.writeHeader(chunk, options);
        // Write chunk to chunk buffer
        for (let i = 0; i < chunkBytes; i++) {
            const offset = Common.HEADER_LENGTH + i;
            chunk.setUint8(offset, this.message[currentIndex + i]);
        }
        return new Uint8Array(chunk.buffer);
    }
}
