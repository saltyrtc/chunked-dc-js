/// <reference path="jasmine.d.ts" />

import { Mode, RELIABLE_ORDERED_HEADER_LENGTH, UNRELIABLE_UNORDERED_HEADER_LENGTH } from '../src/main';
import { Chunk } from '../src/unchunker';

export default () => { describe('Chunk', function() {
    describe('reliable/ordered', () => {
        it('parses valid data', () => {
            const data = Uint8Array.of(
                // Options
                6,
                // Data
                1, 2, 3, 4, 5, 6
            );
            const chunk = new Chunk(data, Mode.ReliableOrdered, RELIABLE_ORDERED_HEADER_LENGTH);
            expect(chunk.endOfMessage).toBe(false);
            expect(chunk.payload).toEqual(Uint8Array.of(1, 2, 3, 4, 5, 6));
        });

        it('parses empty data', () => {
            const data = Uint8Array.of(
                // Options
                7,
            );
            const chunk = new Chunk(data, Mode.ReliableOrdered, RELIABLE_ORDERED_HEADER_LENGTH);
            expect(chunk.endOfMessage).toBe(true);
            expect(chunk.payload).toEqual(new Uint8Array(0));
        });

        it('rejects invalid chunks', () => {
            const data = new Uint8Array(0);
            const parse = () => new Chunk(data, Mode.ReliableOrdered, RELIABLE_ORDERED_HEADER_LENGTH);
            expect(parse).toThrowError('Invalid chunk: Too short');
        });

        it('rejects invalid mode', () => {
            const data = Uint8Array.of(
                // Options
                0,
                // Id
                0xff, 0xff, 0xff, 0xfe,
                // Serial
                0, 0, 0, 1,
                // Data
                1, 2, 3, 4, 5, 6
            );
            const parse = () => new Chunk(data, Mode.ReliableOrdered, RELIABLE_ORDERED_HEADER_LENGTH);
            expect(parse).toThrowError('Invalid chunk: Unexpected mode 0');
        });
    });

    describe('unreliable/unordered', () => {
        it('parses valid data', () => {
            const data = Uint8Array.of(
                // Options
                0,
                // Id
                0xff, 0xff, 0xff, 0xfe,
                // Serial
                0, 0, 0, 1,
                // Data
                1, 2, 3, 4, 5, 6
            );
            const chunk = new Chunk(data, Mode.UnreliableUnordered, UNRELIABLE_UNORDERED_HEADER_LENGTH);
            expect(chunk.endOfMessage).toBe(false);
            expect(chunk.id).toEqual(4294967294);
            expect(chunk.serial).toEqual(1);
            expect(chunk.payload).toEqual(Uint8Array.of(1, 2, 3, 4, 5, 6));
        });

        it('parses empty data', () => {
            const data = Uint8Array.of(
                // Options
                1,
                // Id
                0, 0, 2, 0,
                // Serial
                0, 0, 0, 1
            );
            const chunk = new Chunk(data, Mode.UnreliableUnordered, UNRELIABLE_UNORDERED_HEADER_LENGTH);
            expect(chunk.endOfMessage).toBe(true);
            expect(chunk.id).toEqual(512);
            expect(chunk.serial).toEqual(1);
            expect(chunk.payload).toEqual(new Uint8Array(0));
        });

        it('rejects invalid chunks', () => {
            const data = Uint8Array.of(1, 2, 3);
            const parse = () => new Chunk(data, Mode.UnreliableUnordered, UNRELIABLE_UNORDERED_HEADER_LENGTH);
            expect(parse).toThrowError('Invalid chunk: Too short');
        });

        it('rejects invalid mode', () => {
            const data = Uint8Array.of(
                // Options
                6,
                // Data
                1, 2, 3, 4, 5, 6, 7, 8, 9
            );
            const parse = () => new Chunk(data, Mode.UnreliableUnordered, UNRELIABLE_UNORDERED_HEADER_LENGTH);
            expect(parse).toThrowError('Invalid chunk: Unexpected mode 6');
        });
    });
})};
