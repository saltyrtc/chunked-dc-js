/// <reference path="jasmine.d.ts" />

import {BlobChunker, Uint8ArrayChunker} from "../src/main";
import {Common} from "../src/common";

export default () => { describe('Unchunker', () => {

    const MORE = 0;
    const END = 1;

    const ID = 42;

    const chunkerVariants = [
        {
            name: 'BlobChunker',
            createBuffer: (data) => new Blob([new Uint8Array(data)]),
            createChunker: (...args) => {
                const object = Object.create(BlobChunker.prototype);
                BlobChunker.apply(object, args);
                return object;
            },
        }, {
            name: 'Uint8ArrayChunker',
            createBuffer: (data) => new Uint8Array(data),
            createChunker: (...args) => {
                const object = Object.create(Uint8ArrayChunker.prototype);
                Uint8ArrayChunker.apply(object, args);
                return object;
            },
        },
    ];

    chunkerVariants.forEach((chunkerVariant) => {
        describe(chunkerVariant.name, () => {
            it('chunkifies multiples of the chunk size', () => {
                const arr = chunkerVariant.createBuffer([1, 2, 3, 4, 5, 6]);
                const chunker = chunkerVariant.createChunker(ID, arr, Common.HEADER_LENGTH + 2);
                expect(chunker.hasNext).toBe(true);
                expect(chunker.next().value)
                    .toEqual(chunkerVariant.createBuffer([MORE, /*Id*/0,0,0,ID, /*Serial*/0,0,0,0, /*Data*/1,2]));
                expect(chunker.hasNext).toBe(true);
                expect(chunker.next().value)
                    .toEqual(chunkerVariant.createBuffer([MORE, /*Id*/0,0,0,ID, /*Serial*/0,0,0,1, /*Data*/3,4]));
                expect(chunker.hasNext).toBe(true);
                expect(chunker.next().value)
                    .toEqual(chunkerVariant.createBuffer([END, /*Id*/0,0,0,ID, /*Serial*/0,0,0,2, /*Data*/5,6]));
                expect(chunker.hasNext).toBe(false);
                expect(chunker.next().done).toBe(true);
            });

            it('chunkifies non-multiples of the chunk size', () => {
                const arr = chunkerVariant.createBuffer([1, 2, 3, 4, 5, 6]);
                const chunker = chunkerVariant.createChunker(ID, arr, Common.HEADER_LENGTH + 4);
                expect(chunker.next().value)
                    .toEqual(chunkerVariant.createBuffer([MORE, /*Id*/0,0,0,ID, /*Serial*/0,0,0,0, /*Data*/1,2,3,4]));
                expect(chunker.next().value)
                    .toEqual(chunkerVariant.createBuffer([END, /*Id*/0,0,0,ID, /*Serial*/0,0,0,1, /*Data*/5,6]));
                expect(chunker.next().done).toBe(true);
            });

            it('chunkifies data smaller than chunk size', () => {
                const arr = chunkerVariant.createBuffer([1, 2]);
                const chunker = chunkerVariant.createChunker(ID, arr, Common.HEADER_LENGTH + 99);
                expect(chunker.next().value)
                    .toEqual(chunkerVariant.createBuffer([END, /*Id*/0,0,0,ID, /*Serial*/0,0,0,0, /*Data*/1,2]));
                expect(chunker.next().done).toBe(true);
            });

            it('allows chunk size of 10', () => {
                const arr = chunkerVariant.createBuffer([1, 2]);
                const chunker = chunkerVariant.createChunker(ID, arr, Common.HEADER_LENGTH + 1);
                expect(chunker.next().value)
                    .toEqual(chunkerVariant.createBuffer([MORE, /*Id*/0,0,0,ID, /*Serial*/0,0,0,0, /*Data*/1]));
                expect(chunker.next().value)
                    .toEqual(chunkerVariant.createBuffer([END, /*Id*/0,0,0,ID, /*Serial*/0,0,0,1, /*Data*/2]));
                expect(chunker.next().done).toBe(true);
            });

            it('does not allow chunk size of 0', () => {
                const arr = chunkerVariant.createBuffer([1, 2]);
                expect(() => chunkerVariant.createChunker(ID, arr, 0)).toThrowError(
                    "Chunk size must be at least 10");
            });

            it('does not allow chunk size of only the header length', () => {
                const arr = chunkerVariant.createBuffer([1, 2]);
                expect(() => chunkerVariant.createChunker(ID, arr, Common.HEADER_LENGTH)).toThrowError(
                    "Chunk size must be at least 10");
            });

            it('does not allow negative chunk size', () => {
                const arr = chunkerVariant.createBuffer([1, 2]);
                expect(() => chunkerVariant.createChunker(ID, arr, -2)).toThrowError(
                    "Chunk size must be at least 10");
            });

            it('does not allow chunking of empty messages', () => {
                const arr = chunkerVariant.createBuffer([]);
                expect(() => chunkerVariant.createChunker(ID, arr, Common.HEADER_LENGTH + 2)).toThrowError(
                    "Message may not be empty");
            });

            it('does not allow out-of-bounds id', () => {
                const arr = chunkerVariant.createBuffer([1, 2]);
                expect(() => chunkerVariant.createChunker(2**32, arr, Common.HEADER_LENGTH + 2)).toThrowError(
                    "Message id must be between 0 and 2**32-1");
                expect(() => chunkerVariant.createChunker(-1, arr, Common.HEADER_LENGTH + 2)).toThrowError(
                    "Message id must be between 0 and 2**32-1");
            });

            it('can be iterated using the iterable protocol', () => {
                const arr = chunkerVariant.createBuffer([1, 2, 3, 4, 5, 6]);
                const chunker = chunkerVariant.createChunker(ID, arr, Common.HEADER_LENGTH + 2);
                const chunks = [];
                for (let chunk of chunker) {
                    chunks.push(chunk);
                }
                expect(chunks.length).toEqual(3);
                expect(chunks[0]).toEqual(chunkerVariant.createBuffer([MORE, /*Id*/0,0,0,ID, /*Serial*/0,0,0,0, /*Data*/1,2]));
                expect(chunks[1]).toEqual(chunkerVariant.createBuffer([MORE, /*Id*/0,0,0,ID, /*Serial*/0,0,0,1, /*Data*/3,4]));
                expect(chunks[2]).toEqual(chunkerVariant.createBuffer([END, /*Id*/0,0,0,ID, /*Serial*/0,0,0,2, /*Data*/5,6]));
            });
        }); 
    });

})};
