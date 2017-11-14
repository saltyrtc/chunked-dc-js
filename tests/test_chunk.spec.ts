/// <reference path="jasmine.d.ts" />

import {createChunk, Chunk} from "../src/unchunker";

export default () => { describe('Chunk', function() {

    const chunkVariants = [
        {
            name: 'BlobChunk',
            createBuffer: (data) => new Blob([new Uint8Array(data)]),
        }, {
            name: 'Uint8ArrayChunk',
            createBuffer: (data) => new Uint8Array(data),
        },
    ];

    chunkVariants.forEach((chunkVariant) => {
        describe(chunkVariant.name, () => {
            it('parses valid data', async() => {
                const chunk = await createChunk(chunkVariant.createBuffer([
                    // Options
                    0,
                    // Id
                    0xff, 0xff, 0xff, 0xfe,
                    // Serial
                    0, 0, 0, 1,
                    // Data
                    1, 2, 3, 4, 5, 6
                ]));
                expect(chunk.isEndOfMessage).toBe(false);
                expect(chunk.id).toEqual(4294967294);
                expect(chunk.serial).toEqual(1);
                expect(chunk.data).toEqual(chunkVariant.createBuffer([1, 2, 3, 4, 5, 6]));
            });

            it('parses empty data', async() => {
                const chunk = await createChunk(chunkVariant.createBuffer([
                    // Options
                    1,
                    // Id
                    0, 0, 2, 0,
                    // Serial
                    0, 0, 0, 1
                ]));
                expect(chunk.isEndOfMessage).toBe(true);
                expect(chunk.id).toEqual(512);
                expect(chunk.serial).toEqual(1);
                expect(chunk.data).toEqual(chunkVariant.createBuffer([]));
            });

            it('rejects invalid chunks', async() => {
                const data = chunkVariant.createBuffer([1, 2, 3]);
                try {
                    await createChunk(data);
                    fail('Should error!');
                } catch (err) {
                    expect(err.message).toEqual('Invalid chunk: Too short');
                }
            });
        });
    });

})};
