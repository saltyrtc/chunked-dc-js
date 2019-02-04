/// <reference path="jasmine.d.ts" />
import '../node_modules/@babel/polyfill/dist/polyfill'; // Include ES5 polyfills
import shuffle from '../node_modules/knuth-shuffle-seeded/index.js';
import {Chunker, Unchunker} from "../src/main";

let counter = 1;
beforeEach(() => console.info('------ TEST', counter++, 'BEGIN ------'));

function generate(messageSize: number, chunkSize: number) {
    const buffer = new ArrayBuffer(messageSize); // 10 MiB
    const view = new DataView(buffer);
    for (let i = 0; i < buffer.byteLength; ++i) {
        view.setUint8(i, i % 256);
    }
    const message = new Uint8Array(buffer);
    const chunks = Array.from(new Chunker(42, message, chunkSize));
    return [message, chunks, shuffle(chunks.slice(0), 0.290193899574423)];
}

const tests = [
    [100, 10485760, 16384],
    [100, 10485760, 65536],
    [100, 10485760, 262144],
].map(([iterations, messageSize, chunkSize]: [number, number, number]) => {
    return [iterations, messageSize, chunkSize, generate(messageSize, chunkSize)];
});

describe('Chunker performance', () => {
    for (const test of tests) {
        const [iterations, messageSize, chunkSize, data] = test;
        const message = data[0];
        const description = `${iterations} x ${messageSize / 1048576} MiB messages as ` +
            `${chunkSize / 1024} KiB chunks`;
        it(description, () => {
            const start = performance.now();

            for (let i = 0; i < iterations; ++i) {
                const chunker = new Chunker(i, message, chunkSize);
                for (const _ of chunker) {}
            }

            const end = performance.now();
            console.info(description, `Took ${(end - start) / 1000} seconds`);
            expect(0).toBe(0);
        });
    }
});

describe('Unchunker performance', () => {
    describe('ordered', () => {
        for (const test of tests) {
            const [iterations, messageSize, chunkSize, data] = test;
            const chunks = data[1]; // ordered
            const description = `${chunks.length} x ~${chunkSize / 1024} KiB chunks into ` +
                `${iterations} x ${messageSize / 1048576} MiB messages`;
            it(description, (done) => {
                const unchunker = new Unchunker();
                let reassembledCount = 0;
                unchunker.onMessage = () => {
                    if (++reassembledCount === iterations) {
                        const end = performance.now();
                        console.info(description, `Took ${(end - start) / 1000} seconds`);
                        expect(0).toBe(0);
                        done();
                    }
                };

                const start = performance.now();

                for (let i = 0; i < iterations; ++i) {
                    for (const chunk of chunks) {
                        unchunker.add(chunk.buffer);
                    }
                }
            });
        }
    });

    describe('unordered', () => {
        for (const test of tests) {
            const [iterations, messageSize, chunkSize, data] = test;
            const chunks = data[2];  // deterministically shuffled
            const description = `${chunks.length} x ~${chunkSize / 1024} KiB chunks into ` +
                `${iterations} x ${messageSize / 1048576} MiB messages`;
            it(description, (done) => {
                const unchunker = new Unchunker();
                let reassembledCount = 0;
                unchunker.onMessage = () => {
                    if (++reassembledCount === iterations) {
                        const end = performance.now();
                        console.info(description, `Took ${(end - start) / 1000} seconds`);
                        expect(0).toBe(0);
                        done();
                    }
                };

                const start = performance.now();

                for (let i = 0; i < iterations; ++i) {
                    for (const chunk of chunks) {
                        unchunker.add(chunk.buffer);
                    }
                }
            });
        }
    });
});
