/// <reference path="jasmine.d.ts" />

import {Chunk} from "../src/unchunker";

export default () => { describe('Chunk', function() {

    it('parses valid data', () => {
        const arr = Uint8Array.of(
            // Options
            0,
            // Id
            0xff, 0xff, 0xff, 0xfe,
            // Serial
            0, 0, 0, 1,
            // Data
            1, 2, 3, 4, 5, 6
        );
        const chunk = new Chunk(arr.buffer);
        expect(chunk.isEndOfMessage).toBe(false);
        expect(chunk.id).toEqual(4294967294);
        expect(chunk.serial).toEqual(1);
        expect(chunk.data).toEqual(Uint8Array.of(1, 2, 3, 4, 5, 6));
    });

    it('parses empty data', () => {
        const arr = Uint8Array.of(
            // Options
            1,
            // Id
            0, 0, 2, 0,
            // Serial
            0, 0, 0, 1
        );
        const chunk = new Chunk(arr.buffer);
        expect(chunk.isEndOfMessage).toBe(true);
        expect(chunk.id).toEqual(512);
        expect(chunk.serial).toEqual(1);
        expect(chunk.data).toEqual(new Uint8Array(0));
    });

    it('rejects invalid chunks', () => {
        const arr = Uint8Array.of(1, 2, 3);
        const parse = () => new Chunk(arr.buffer);
        expect(parse).toThrowError("Invalid chunk: Too short");
    });

})};
