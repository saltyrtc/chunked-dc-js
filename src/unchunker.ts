/**
 * Copyright (C) 2016-2019 Threema GmbH / SaltyRTC Contributors
 *
 * Licensed under the Apache License, Version 2.0, <see LICENSE-APACHE file>
 * or the MIT license <see LICENSE-MIT file>, at your option. This file may not be
 * copied, modified, or distributed except according to those terms.
 */
/// <reference path='../chunked-dc.d.ts' />

import { Mode, MODE_BITMASK, RELIABLE_ORDERED_HEADER_LENGTH, UNRELIABLE_UNORDERED_HEADER_LENGTH } from './common';

/**
 * Helper class to store chunk information.
 */
export class Chunk {
    public readonly endOfMessage: boolean;
    public readonly id: number;
    public readonly serial: number;
    public readonly payload: Uint8Array;

    /**
     * Parse the chunk.
     *
     * @param chunkArray The chunk's array which will be **referenced**.
     * @param expectedMode The mode we expect the chunk to use.
     * @param headerLength The expected header length.
     * @throws Error if message is smaller than the header length or an unexpected mode has been detected.
     */
    public constructor(chunkArray: Uint8Array, expectedMode: Mode, headerLength: number) {
        if (chunkArray.byteLength < headerLength) {
            throw new Error('Invalid chunk: Too short');
        }

        // Read header
        const chunkView = new DataView(chunkArray.buffer, chunkArray.byteOffset, chunkArray.byteLength);
        const options = chunkView.getUint8(0);
        const actualMode = (options & MODE_BITMASK); // tslint:disable-line:no-bitwise
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
        this.endOfMessage = (options & 1) === 1; // tslint:disable-line:no-bitwise

        // Store payload
        this.payload = chunkArray.subarray(headerLength);
    }
}

/**
 * Copies chunks into a contiguous buffer.
 */
class ContiguousBufferReassembler {
    private complete: boolean = false;
    private buffer: ArrayBuffer | null;
    private array: Uint8Array | null;
    private offset: number;
    private remaining: number;

    /**
     * Create a reassembler for reliable & ordered mode.
     *
     * @param buffer A message buffer to be used for handing out messages.
     *   If the message grows larger than the underlying buffer, it will be
     *   replaced. A new buffer will be created when needed if not supplied.
     */
    public constructor(buffer: ArrayBuffer | null = null) {
        this.buffer = buffer;
        if (this.buffer !== null) {
            this.array = new Uint8Array(this.buffer);
            this.offset = 0;
            this.remaining = this.buffer.byteLength;
        } else {
            this.array = null;
            this.offset = 0;
            this.remaining = 0;
        }
    }

    /**
     * Return `true` in case nothing has been written to the reassembler, yet.
     */
    public get empty(): boolean {
        return this.offset === 0;
    }

    /**
     * Append a chunk to the internal buffer.
     *
     * Important: Do not mix chunks with different ids in the same reassembler
     *            instance or it will break!
     *
     * @param chunk The chunk to be appended.
     * @throws Error if the message is already complete.
     */
    public add(chunk: Chunk): void {
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

    /**
     * Append a batch of chunks to the internal buffer.
     *
     * Important: Do not mix chunks with different ids in the same reassembler
     *            instance or it will break!
     *
     * @param chunks The chunks to be appended.
     * @param totalByteLength The accumulated byte length of the chunks.
     * @return the last chunk that has been added.
     * @throws Error if the message is already complete.
     */
    public addBatched(chunks: Chunk[], totalByteLength: number): Chunk {
        this.maybeResize(totalByteLength);
        let chunk: Chunk;
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

    /**
     * Prepare the internal buffer so one or more new chunks can be safely
     * added.
     *
     * Note: We apply a heuristic here to double the buffer's size, so we don't
     *       need to create new buffers and copy every time. This should be
     *       faster than merging at the end since we can expect that the local
     *       machine copies memory faster than it will receive new chunks.
     *
     * @param requiredLength The required byte length.
     */
    private maybeResize(requiredLength: number): void {
        // We have no underlying buffer - allocate it directly for the required size
        if (this.buffer === null) {
            this.buffer = new ArrayBuffer(requiredLength);
            this.array = new Uint8Array(this.buffer);
            return;
        }

        // Reallocate the underlying buffer if needed
        if (this.remaining < requiredLength) {
            const previousArray = this.array;
            const length = Math.max(previousArray.byteLength * 2, previousArray.byteLength + requiredLength);
            this.buffer = new ArrayBuffer(length);
            this.array = new Uint8Array(this.buffer);
            this.array.set(previousArray);
            this.remaining = length - this.offset;
        }
    }

    /**
     * Extract the complete message from the internal buffer as a view.
     *
     * Important: The returned message's underlying buffer will be reused with
     *            the next chunk being reassembled.
     *
     * @return The completed message.
     * @throws Error if the message is not yet complete.
     */
    public getMessage(): Uint8Array {
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

/**
 * Reorders chunks and then copies them into a contiguous buffer.
 */
class UnreliableUnorderedReassembler {
    private readonly contiguousChunks: ContiguousBufferReassembler = new ContiguousBufferReassembler();
    private queuedChunks: Chunk[] | null = null;
    private queuedChunksTotalByteLength: number = 0;
    private _chunkCount: number = 0;
    private nextOrderedSerial: number = 0;
    private lastUpdate: number = new Date().getTime();
    private requiredChunkCount: number | null = null;

    /**
     * Return the number of added chunks.
     */
    public get chunkCount(): number {
        return this._chunkCount;
    }

    /**
     * Return whether the message is complete, meaning that all chunks of the message arrived.
     */
    public get complete() {
        return this.requiredChunkCount !== null && this._chunkCount === this.requiredChunkCount;
    }

    /**
     * Add a new chunk.
     *
     * Important: Do not mix chunks with different ids in the same reassembler
     *            instance or it will break!
     *
     * @throws Error if the message is already complete.
     */
    public add(chunk: Chunk): void {
        // Already complete?
        if (this.complete) {
            throw new Error('Message already complete');
        }

        if (this.queuedChunks === null && chunk.serial === this._chunkCount) {
            // In order: Can be added to the contiguous chunks
            this.contiguousChunks.add(chunk);
            this.nextOrderedSerial = chunk.serial + 1;
        } else {
            // Out of order: Needs to be temporarily stored in a queue
            const ready = this.queueUnorderedChunk(chunk);
            if (ready) {
                // Queue is ready to be moved into the contiguous buffer.
                this.moveQueuedChunks();
            }
        }

        // Check if this is the last chunk received
        if (chunk.endOfMessage) {
            this.requiredChunkCount = chunk.serial + 1;
        }

        // Update chunk counter and timestamp
        ++this._chunkCount;
        this.lastUpdate = new Date().getTime();
    }

    /**
     * Add a new chunk to its intended position in the out-of-order queue.
     *
     * Note: We continuously sort the queue by the serial number (ascending).
     *
     * @returns whether the queue is ready to be moved into the contiguous buffer.
     */
    private queueUnorderedChunk(chunk: Chunk): boolean {
        // Append chunk
        this.queuedChunksTotalByteLength += chunk.payload.byteLength;
        if (this.queuedChunks === null) {
            this.queuedChunks = [chunk];
            return false;
        }
        this.queuedChunks.push(chunk);

        // Sort chunk queue
        this.queuedChunks.sort((a: Chunk, b: Chunk) => {
            if (a.serial < b.serial) {
                return -1;
            }
            if (a.serial > b.serial) {
                return 1;
            }
            return 0;
        });

        // Check if ready
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

    /**
     * Moves the queued chunks to the contiguous buffer.
     *
     * Should be called once the queue contains consecutive chunks and there is
     * no gap between the contiguous chunk buffer and our queued chunks.
     */
    private moveQueuedChunks(): void {
        const chunk = this.contiguousChunks.addBatched(this.queuedChunks, this.queuedChunksTotalByteLength);
        // Note: `chunk` is the last chunk in the sequence and has the highest serial number
        this.nextOrderedSerial = chunk.serial + 1;
        this.queuedChunks = null;
    }

    /**
     * Get the reassembled message.
     *
     * @return The completed message.
     * @throws Error if the message is not yet complete.
     */
    public getMessage(): Uint8Array {
        if (!this.complete) {
            throw new Error('Message not complete');
        }
        return this.contiguousChunks.getMessage();
    }

    /**
     * Return whether last chunk is older than the specified number of milliseconds.
     */
    public isOlderThan(maxAge: number): boolean {
        const age = (new Date().getTime() - this.lastUpdate);
        return age > maxAge;
    }
}

/**
 * An unchunker reassembles multiple chunks into a single message.
 */
abstract class AbstractUnchunker implements chunkedDc.Unchunker {
    /**
     * Message listener. Set by the user.
     *
     * Important: The passed message's underlying buffer will be reused with
     *            the next chunk being reassembled.
     */
    public onMessage: (message: Uint8Array) => void = null;

    /**
     * Notify message listener about a complete message.
     */
    protected notifyListener(message: Uint8Array) {
        if (this.onMessage != null) {
            this.onMessage(message);
        }
    }

    /**
     * Add a chunk.
     *
     * @param chunkArray A chunk containing either a 1 byte or 9 byte header.
     *   Important: The chunk's underlying buffer should be considered transferred!
     * @throws Error if message is smaller than the header length or an unknown
     *   mode has been detected.
     */
    public abstract add(chunkArray: Uint8Array): void;
}

/**
 * An unchunker for reliable & ordered mode.
 */
export class ReliableOrderedUnchunker extends AbstractUnchunker implements chunkedDc.ReliableOrderedUnchunker {
    private readonly reassembler: ContiguousBufferReassembler;

    /**
     * Create an unchunker for reliable & ordered mode.
     *
     * @param buffer A message buffer to be used for handing out messages.
     *   If the message grows larger than the underlying buffer, it will be
     *   replaced. A new buffer will be created when needed if not supplied.
     */
    public constructor(buffer?: ArrayBuffer) {
        super();
        this.reassembler = new ContiguousBufferReassembler(buffer);
    }

    /**
     * Add a chunk.
     *
     * @param chunkArray A chunk containing a 1 byte header.
     *   Important: The chunk's underlying buffer should be considered transferred!
     * @throws Error if message is smaller than the header length or an unknown
     *   mode has been detected.
     */
    public add(chunkArray: Uint8Array): void {
        // Parse chunk
        const chunk = new Chunk(chunkArray, Mode.ReliableOrdered, RELIABLE_ORDERED_HEADER_LENGTH);

        // If this is a single chunk that contains the whole message, return it immediately.
        if (this.reassembler.empty && chunk.endOfMessage) {
            this.notifyListener(chunk.payload);
            return;
        }

        // Add the chunk's payload to the message buffer.
        this.reassembler.add(chunk);

        // Check if message is complete
        if (chunk.endOfMessage) {
            // Hand out the message and reset the buffer
            this.notifyListener(this.reassembler.getMessage());
        }
    }
}

/**
 * A reassembler optimised for unreliable & unordered mode.
 */
export class UnreliableUnorderedUnchunker extends AbstractUnchunker implements chunkedDc.UnreliableUnorderedUnchunker {
    private reassemblers: Map<number, UnreliableUnorderedReassembler> = new Map();

    /**
     * Add a chunk.
     *
     * @param chunkArray A chunk containing a 9 byte header.
     *   Important: The chunk's underlying buffer should be considered transferred!
     * @throws Error if message is smaller than the header length or an unknown
     *   mode has been detected.
     */
    public add(chunkArray: Uint8Array): void {
        // Parse chunk
        const chunk = new Chunk(chunkArray, Mode.UnreliableUnordered, UNRELIABLE_UNORDERED_HEADER_LENGTH);

        // If this is a single chunk that contains the whole message, return it immediately.
        if (chunk.endOfMessage && chunk.serial === 0) {
            this.notifyListener(chunk.payload);
            return;
        }

        // Add chunk to reassembler
        let reassembler: UnreliableUnorderedReassembler = this.reassemblers.get(chunk.id);
        if (reassembler === undefined) {
            reassembler = new UnreliableUnorderedReassembler();
            this.reassemblers.set(chunk.id, reassembler);
        }
        reassembler.add(chunk);

        // Check if message is complete
        if (reassembler.complete) {
            // Hand out the message and delete the message's reassembler
            this.notifyListener(reassembler.getMessage());
            this.reassemblers.delete(chunk.id);
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
     */
    public gc(maxAge: number): number {
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
