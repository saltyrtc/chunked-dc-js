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
    private arr: Uint8Array;

    /**
     * Create a Chunker instance.
     *
     * @param id An identifier for the message. Must be between 0 and 2**32-1.
     * @param arr The Uint8Array containing the bytes that should be chunked.
     * @param chunkSize The chunk size *excluding* header data.
     */
    constructor(id: number, arr: Uint8Array, chunkSize: number) {
        if (chunkSize < 1) {
            throw new Error("Chunk size must be at least 1");
        }
        if (arr.byteLength < 1) {
            throw new Error("Array may not be empty");
        }
        if (id < 0 || id >= 2**32) {
            throw new Error("Message id must be between 0 and 2**32-1");
        }
        this.id = id;
        this.arr = arr;
        this.chunkSize = chunkSize;
    }

    /**
     * Return the next chunk, or `null` if there are no chunks remaining.
     */
    public next(): Uint8Array {
        const currentIndex = this.chunkId * this.chunkSize;
        const remaining = this.arr.byteLength - currentIndex;
        if (remaining < 1) {
            return null;
        }

        // Allocate chunk buffer
        const chunkBytes = remaining < this.chunkSize ? remaining : this.chunkSize;
        const chunk = new DataView(new ArrayBuffer(chunkBytes + Common.HEADER_LENGTH));

        // Create header
        const config = remaining > chunkBytes ? 0 : 1;
        const id = this.id;
        const serial = this.nextSerial();

        // Write to chunk buffer
        chunk.setUint8(0, config);
        chunk.setUint32(1, id);
        chunk.setUint32(5, serial);
        for (let i = 0; i < chunkBytes; i++) {
            const offset = Common.HEADER_LENGTH + i;
            chunk.setUint8(offset, this.arr[currentIndex + i]);
        }
        return new Uint8Array(chunk.buffer);
    }

    /**
     * Return and post-increment the id of the next block
     */
    private nextSerial(): number {
        return this.chunkId++;
    }

}
