/// <reference path="jasmine.d.ts" />

import {
    RELIABLE_ORDERED_HEADER_LENGTH,
    UNRELIABLE_UNORDERED_HEADER_LENGTH,
    ReliableOrderedChunker,
    UnreliableUnorderedChunker,
} from '../src/main';

export default () => { describe('UnreliableUnorderedChunker', function() {
    const tests: Array<ArrayBuffer | undefined> = [new ArrayBuffer(128), undefined];

    for (const buffer of tests) {
        const hasBufferStr = buffer !== undefined ? 'yes' : 'no';

        describe(`ReliableOrderedChunker (buffer=${hasBufferStr})`, () => {
            const MORE = 6;
            const END = 7;

            it('chunkifies multiples of the chunk size', () => {
                const message = Uint8Array.of(1, 2, 3, 4, 5, 6);
                const chunker = new ReliableOrderedChunker(message, RELIABLE_ORDERED_HEADER_LENGTH + 2, buffer);
                expect(chunker.hasNext).toBe(true);
                expect(chunker.next().value)
                    .toEqual(Uint8Array.of(MORE, /*Data*/1, 2));
                expect(chunker.hasNext).toBe(true);
                expect(chunker.next().value)
                    .toEqual(Uint8Array.of(MORE, /*Data*/3, 4));
                expect(chunker.hasNext).toBe(true);
                expect(chunker.next().value)
                    .toEqual(Uint8Array.of(END, /*Data*/5, 6));
                expect(chunker.hasNext).toBe(false);
                expect(chunker.next().done).toBe(true);
            });

            it('chunkifies non-multiples of the chunk size', () => {
                const message = Uint8Array.of(1, 2, 3, 4, 5, 6);
                const chunker = new ReliableOrderedChunker(message, RELIABLE_ORDERED_HEADER_LENGTH + 4, buffer);
                expect(chunker.next().value)
                    .toEqual(Uint8Array.of(MORE, /*Data*/1, 2, 3, 4));
                expect(chunker.next().value)
                    .toEqual(Uint8Array.of(END, /*Data*/5, 6));
                expect(chunker.next().done).toBe(true);
            });

            it('chunkifies data smaller than chunk size', () => {
                const message = Uint8Array.of(1, 2);
                const chunker = new ReliableOrderedChunker(message, RELIABLE_ORDERED_HEADER_LENGTH + 99, buffer);
                expect(chunker.next().value)
                    .toEqual(Uint8Array.of(END, /*Data*/1, 2));
                expect(chunker.next().done).toBe(true);
            });

            it('allows chunk size of 2', () => {
                const message = Uint8Array.of(1, 2);
                const chunker = new ReliableOrderedChunker(message, RELIABLE_ORDERED_HEADER_LENGTH + 1, buffer);
                expect(chunker.next().value)
                    .toEqual(Uint8Array.of(MORE, /*Data*/1));
                expect(chunker.next().value)
                    .toEqual(Uint8Array.of(END, /*Data*/2));
                expect(chunker.next().done).toBe(true);
            });

            it('does not allow chunk size of 0', () => {
                const message = Uint8Array.of(1, 2);
                expect(() => new ReliableOrderedChunker(message, 0, buffer))
                    .toThrowError('Chunk size must be at least 2');
            });

            it('does not allow chunk size of only the header length', () => {
                const message = Uint8Array.of(1, 2);
                expect(() => new ReliableOrderedChunker(message, RELIABLE_ORDERED_HEADER_LENGTH, buffer))
                    .toThrowError('Chunk size must be at least 2');
            });

            it('does not allow negative chunk size', () => {
                const message = Uint8Array.of(1, 2);
                expect(() => new ReliableOrderedChunker(message, -2, buffer))
                    .toThrowError('Chunk size must be at least 2');
            });

            it('does not allow chunking of empty arrays', () => {
                const message = new Uint8Array(0);
                expect(() => new ReliableOrderedChunker(message, RELIABLE_ORDERED_HEADER_LENGTH + 2, buffer))
                    .toThrowError('Message may not be empty');
            });

            it('can be iterated using the iterable protocol', () => {
                const message = Uint8Array.of(1, 2, 3, 4, 5, 6);
                const chunker = new ReliableOrderedChunker(message, RELIABLE_ORDERED_HEADER_LENGTH + 2, buffer);
                const chunks = [];
                for (let chunk of chunker) {
                    chunks.push(chunk.slice());
                }
                expect(chunks.length).toEqual(3);
                expect(chunks[0]).toEqual(Uint8Array.of(MORE, /*Data*/1, 2));
                expect(chunks[1]).toEqual(Uint8Array.of(MORE, /*Data*/3, 4));
                expect(chunks[2]).toEqual(Uint8Array.of(END, /*Data*/5, 6));
            });
        });

        describe(`UnreliableUnorderedChunker (buffer=${hasBufferStr})`, () => {
            const MORE = 0;
            const END = 1;
            const ID = 42;

            it('chunkifies multiples of the chunk size', () => {
                const message = Uint8Array.of(1, 2, 3, 4, 5, 6);
                const chunker = new UnreliableUnorderedChunker(
                    ID, message, UNRELIABLE_UNORDERED_HEADER_LENGTH + 2, buffer);
                expect(chunker.hasNext).toBe(true);
                expect(chunker.next().value)
                    .toEqual(Uint8Array.of(MORE, /*Id*/0, 0, 0, ID, /*Serial*/0, 0, 0, 0, /*Data*/1, 2));
                expect(chunker.hasNext).toBe(true);
                expect(chunker.next().value)
                    .toEqual(Uint8Array.of(MORE, /*Id*/0, 0, 0, ID, /*Serial*/0, 0, 0, 1, /*Data*/3, 4));
                expect(chunker.hasNext).toBe(true);
                expect(chunker.next().value)
                    .toEqual(Uint8Array.of(END, /*Id*/0, 0, 0, ID, /*Serial*/0, 0, 0, 2, /*Data*/5, 6));
                expect(chunker.hasNext).toBe(false);
                expect(chunker.next().done).toBe(true);
            });

            it('chunkifies non-multiples of the chunk size', () => {
                const message = Uint8Array.of(1, 2, 3, 4, 5, 6);
                const chunker = new UnreliableUnorderedChunker(
                    ID, message, UNRELIABLE_UNORDERED_HEADER_LENGTH + 4, buffer);
                expect(chunker.next().value)
                    .toEqual(Uint8Array.of(MORE, /*Id*/0, 0, 0, ID, /*Serial*/0, 0, 0, 0, /*Data*/1, 2, 3, 4));
                expect(chunker.next().value)
                    .toEqual(Uint8Array.of(END, /*Id*/0, 0, 0, ID, /*Serial*/0, 0, 0, 1, /*Data*/5, 6));
                expect(chunker.next().done).toBe(true);
            });

            it('chunkifies data smaller than chunk size', () => {
                const message = Uint8Array.of(1, 2);
                const chunker = new UnreliableUnorderedChunker(
                    ID, message, UNRELIABLE_UNORDERED_HEADER_LENGTH + 99, buffer);
                expect(chunker.next().value)
                    .toEqual(Uint8Array.of(END, /*Id*/0, 0, 0, ID, /*Serial*/0, 0, 0, 0, /*Data*/1, 2));
                expect(chunker.next().done).toBe(true);
            });

            it('allows chunk size of 10', () => {
                const message = Uint8Array.of(1, 2);
                const chunker = new UnreliableUnorderedChunker(
                    ID, message, UNRELIABLE_UNORDERED_HEADER_LENGTH + 1, buffer);
                expect(chunker.next().value)
                    .toEqual(Uint8Array.of(MORE, /*Id*/0, 0, 0, ID, /*Serial*/0, 0, 0, 0, /*Data*/1));
                expect(chunker.next().value)
                    .toEqual(Uint8Array.of(END, /*Id*/0, 0, 0, ID, /*Serial*/0, 0, 0, 1, /*Data*/2));
                expect(chunker.next().done).toBe(true);
            });

            it('does not allow chunk size of 0', () => {
                const message = Uint8Array.of(1, 2);
                expect(() => new UnreliableUnorderedChunker(ID, message, 0, buffer))
                    .toThrowError('Chunk size must be at least 10');
            });

            it('does not allow chunk size of only the header length', () => {
                const message = Uint8Array.of(1, 2);
                expect(() => new UnreliableUnorderedChunker(ID, message, UNRELIABLE_UNORDERED_HEADER_LENGTH, buffer))
                    .toThrowError('Chunk size must be at least 10');
            });

            it('does not allow negative chunk size', () => {
                const message = Uint8Array.of(1, 2);
                expect(() => new UnreliableUnorderedChunker(ID, message, -2, buffer))
                    .toThrowError('Chunk size must be at least 10');
            });

            it('does not allow chunking of empty arrays', () => {
                const message = new Uint8Array(0);
                expect(() => new UnreliableUnorderedChunker(
                    ID, message, UNRELIABLE_UNORDERED_HEADER_LENGTH + 2, buffer))
                    .toThrowError('Message may not be empty');
            });

            it('does not allow out-of-bounds id', () => {
                const message = Uint8Array.of(1, 2);
                expect(() => new UnreliableUnorderedChunker(
                    2 ** 32, message, UNRELIABLE_UNORDERED_HEADER_LENGTH + 2, buffer))
                    .toThrowError('Message id must be between 0 and 2**32-1');
                expect(() => new UnreliableUnorderedChunker(
                    -1, message, UNRELIABLE_UNORDERED_HEADER_LENGTH + 2, buffer))
                    .toThrowError('Message id must be between 0 and 2**32-1');
            });

            it('can be iterated using the iterable protocol', () => {
                const message = Uint8Array.of(1, 2, 3, 4, 5, 6);
                const chunker = new UnreliableUnorderedChunker(
                    ID, message, UNRELIABLE_UNORDERED_HEADER_LENGTH + 2, buffer);
                const chunks = [];
                for (let chunk of chunker) {
                    chunks.push(chunk.slice());
                }
                expect(chunks.length).toEqual(3);
                expect(chunks[0]).toEqual(Uint8Array.of(MORE, /*Id*/0, 0, 0, ID, /*Serial*/0, 0, 0, 0, /*Data*/1, 2));
                expect(chunks[1]).toEqual(Uint8Array.of(MORE, /*Id*/0, 0, 0, ID, /*Serial*/0, 0, 0, 1, /*Data*/3, 4));
                expect(chunks[2]).toEqual(Uint8Array.of(END, /*Id*/0, 0, 0, ID, /*Serial*/0, 0, 0, 2, /*Data*/5, 6));
            });
        });
    }
})};
