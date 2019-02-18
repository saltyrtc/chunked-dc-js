/// <reference path="jasmine.d.ts" />
import '../node_modules/@babel/polyfill/dist/polyfill'; // Include ES5 polyfills
import shuffle from '../node_modules/knuth-shuffle-seeded/index.js';
import {
    ReliableOrderedChunker, UnreliableUnorderedChunker,
    ReliableOrderedUnchunker, UnreliableUnorderedUnchunker
} from "../src/main";

let counter = 1;
beforeEach(() => console.info('------ TEST', counter++, 'BEGIN ------'));

type PartialTest = {
    iterations: number,
    messageLength: number,
    chunkLength: number,
}

type Test = {
    iterations: number,
    messageLength: number,
    chunkLength: number,
    message: Uint8Array,
    reliableOrderedChunks: Array<Uint8Array>,
    unreliableUnorderedChunks: Array<Uint8Array>,
    shuffledUnreliableUnorderedChunks: Array<Uint8Array>,
}

function generate(partial: PartialTest): Test {
    const test = partial as Test;
    const buffer = new ArrayBuffer(test.messageLength);
    const view = new DataView(buffer);
    for (let i = 0; i < buffer.byteLength; ++i) {
        view.setUint8(i, i % 256);
    }
    test.message = new Uint8Array(buffer);
    test.reliableOrderedChunks = Array.from(
        new ReliableOrderedChunker(test.message, test.chunkLength));
    test.unreliableUnorderedChunks = Array.from(
        new UnreliableUnorderedChunker(42, test.message, test.chunkLength));
    test.shuffledUnreliableUnorderedChunks = shuffle(test.unreliableUnorderedChunks.slice(), 0.290193899574423);
    return test;
}

const tests = [
    { iterations: 100, messageLength: 10485760, chunkLength: 16384 },
    { iterations: 100, messageLength: 10485760, chunkLength: 65536 },
    { iterations: 100, messageLength: 10485760, chunkLength: 262144 },
].map((test: PartialTest) => generate(test));

describe('Uint8Array performance', () => {
    {
        const description = '100 x direct construction with capacity of 10 MiB';
        it(description, () => {
            const start = performance.now();
            for (let i = 0; i < 1000; ++i) {
                const array = new Uint8Array(10485760);
                array[0] = 0xff;
            }
            const end = performance.now();
            console.info(description, `Took ${(end - start) / 1000} seconds`);
            expect(0).toBe(0);
        });
    }

    {
        const description = '100 x construction via ArrayBuffer with capacity of 10 MiB';
        it(description, () => {
            const start = performance.now();
            for (let i = 0; i < 1000; ++i) {
                const array = new Uint8Array(new ArrayBuffer(10485760));
                array[0] = 0xff;
            }
            const end = performance.now();
            console.info(description, `Took ${(end - start) / 1000} seconds`);
            expect(0).toBe(0);
        });
    }

    {
        const description = '100 x copying (.slice) with capacity of 10 MiB';
        it(description, () => {
            const data = new Uint8Array(10485760);
            const start = performance.now();
            for (let i = 0; i < 1000; ++i) {
                const copy = data.slice(0);
                copy[0] = 0xff;
            }
            const end = performance.now();
            console.info(description, `Took ${(end - start) / 1000} seconds`);
            expect(0).toBe(0);
        });
    }

    {
        const description = '100 x copying (new Uint8Array) with capacity of 10 MiB';
        it(description, () => {
            const data = new Uint8Array(10485760);
            const start = performance.now();
            for (let i = 0; i < 1000; ++i) {
                const copy = new Uint8Array(data);
                copy[0] = 0xff;
            }
            const end = performance.now();
            console.info(description, `Took ${(end - start) / 1000} seconds`);
            expect(0).toBe(0);
        });
    }

    {
        const description = '100 x copying (.set) with capacity of 10 MiB';
        it(description, () => {
            const data = new Uint8Array(10485760);
            const start = performance.now();
            for (let i = 0; i < 1000; ++i) {
                const newData = new Uint8Array(10485760);
                newData.set(data, 0);
            }
            const end = performance.now();
            console.info(description, `Took ${(end - start) / 1000} seconds`);
            expect(0).toBe(0);
        });
    }

    {
        const description = '100 x viewing (.subarray) with capacity of 10 MiB';
        it(description, () => {
            const data = new Uint8Array(10485760);
            const start = performance.now();
            for (let i = 0; i < 1000; ++i) {
                data.subarray(0, data.byteLength);
            }
            const end = performance.now();
            console.info(description, `Took ${(end - start) / 1000} seconds`);
            expect(0).toBe(0);
        });
    }

    for (const test of tests) {
        const chunks = test.reliableOrderedChunks;
        const totalChunkLength = chunks.length * test.chunkLength;

        {
            const description = `100x copying ${chunks.length} x ~${test.chunkLength / 1024} KiB chunks into a ` +
                `contiguous buffer of ${totalChunkLength / 1048576} MiB (omniscient buffer)`;
            it(description, () => {
                const start = performance.now();

                for (let i = 0; i < 100; ++i) {
                    const array = new Uint8Array(totalChunkLength);
                    let offset = 0;
                    for (const chunk of chunks) {
                        array.set(chunk, offset);
                        offset += chunk.byteLength;
                    }
                }

                const end = performance.now();
                console.info(description, `Took ${(end - start) / 1000} seconds`);
                expect(0).toBe(0);
            });
        }

        {
            const description = `100x copying ${chunks.length} x ~${test.chunkLength / 1024} KiB chunks into a ` +
                `contiguous buffer of ${totalChunkLength / 1048576} MiB (double array length if chunk does not fit)`;
            it(description, () => {
                const start = performance.now();

                for (let i = 0; i < 100; ++i) {
                    let array = new Uint8Array(test.chunkLength);
                    let offset = 0;
                    let remaining = array.byteLength;
                    for (const chunk of chunks) {
                        if (remaining < chunk.byteLength) {
                            const previousArray = array;
                            const length = previousArray.byteLength * 2;
                            array = new Uint8Array(length);
                            array.set(previousArray);
                            offset = previousArray.byteLength;
                            remaining = length - offset;
                        }
                        array.set(chunk, offset);
                        offset += chunk.byteLength;
                        remaining -= chunk.byteLength;
                    }
                }

                const end = performance.now();
                console.info(description, `Took ${(end - start) / 1000} seconds`);
                expect(0).toBe(0);
            });
        }

        {
            const description = `100x copying ${chunks.length} x ~${test.chunkLength / 1024} KiB chunks into a ` +
                `contiguous buffer of ${totalChunkLength / 1048576} MiB (double pre-allocated buffer length if chunk ` +
                'does not fit)';
            it(description, () => {
                let buffer = new ArrayBuffer(test.chunkLength);
                const start = performance.now();

                for (let i = 0; i < 100; ++i) {
                    let array = new Uint8Array(buffer);
                    let offset = 0;
                    let remaining = array.byteLength;
                    for (const chunk of chunks) {
                        if (remaining < chunk.byteLength) {
                            const previousArray = array;
                            const length = previousArray.byteLength * 2;
                            buffer = new ArrayBuffer(length);
                            array = new Uint8Array(buffer);
                            array.set(previousArray);
                            offset = previousArray.byteLength;
                            remaining = length - offset;
                        }
                        array.set(chunk, offset);
                        offset += chunk.byteLength;
                        remaining -= chunk.byteLength;
                    }
                }

                const end = performance.now();
                console.info(description, `Took ${(end - start) / 1000} seconds`);
                expect(0).toBe(0);
            });
        }

        {
            const description = `100x merging ${chunks.length} x ~${test.chunkLength / 1024} KiB chunks into a ` +
                `contiguous buffer of ${totalChunkLength / 1048576} MiB`;
            it(description, () => {
                const start = performance.now();

                for (let i = 0; i < 100; ++i) {
                    let length = 0;
                    const list = [];
                    for (const chunk of chunks) {
                        list.push(chunk);
                        length += chunk.byteLength;
                    }
                    const array = new Uint8Array(length);
                    let offset = 0;
                    for (const chunk of list) {
                        array.set(chunk, offset);
                        offset += chunk.byteLength;
                    }
                }

                const end = performance.now();
                console.info(description, `Took ${(end - start) / 1000} seconds`);
                expect(0).toBe(0);
            });
        }
    }
});

describe('Chunker performance', () => {
    describe('ordered (with reused buffer)', () => {
        for (const test of tests) {
            const description = `${test.iterations} x ${test.messageLength / 1048576} MiB messages as ` +
                `${test.chunkLength / 1024} KiB chunks`;
            it(description, () => {
                const buffer = new ArrayBuffer(test.chunkLength);
                const start = performance.now();

                for (let i = 0; i < test.iterations; ++i) {
                    const chunker = new ReliableOrderedChunker(test.message, test.chunkLength, buffer);
                    for (const _ of chunker) {}
                }

                const end = performance.now();
                console.info(description, `Took ${(end - start) / 1000} seconds`);
                expect(0).toBe(0);
            });
        }
    });

    describe('ordered (without reused buffer)', () => {
        for (const test of tests) {
            const description = `${test.iterations} x ${test.messageLength / 1048576} MiB messages as ` +
                `${test.chunkLength / 1024} KiB chunks`;
            it(description, () => {
                const start = performance.now();

                for (let i = 0; i < test.iterations; ++i) {
                    const chunker = new ReliableOrderedChunker(test.message, test.chunkLength);
                    for (const _ of chunker) {}
                }

                const end = performance.now();
                console.info(description, `Took ${(end - start) / 1000} seconds`);
                expect(0).toBe(0);
            });
        }
    });

    describe('unordered (with reused buffer)', () => {
        for (const test of tests) {
            const description = `${test.iterations} x ${test.messageLength / 1048576} MiB messages as ` +
                `${test.chunkLength / 1024} KiB chunks`;
            it(description, () => {
                const buffer = new ArrayBuffer(test.chunkLength);
                const start = performance.now();

                for (let i = 0; i < test.iterations; ++i) {
                    const chunker = new UnreliableUnorderedChunker(42, test.message, test.chunkLength, buffer);
                    for (const _ of chunker) {}
                }

                const end = performance.now();
                console.info(description, `Took ${(end - start) / 1000} seconds`);
                expect(0).toBe(0);
            });
        }
    });

    describe('unordered (without reused buffer)', () => {
        for (const test of tests) {
            const description = `${test.iterations} x ${test.messageLength / 1048576} MiB messages as ` +
                `${test.chunkLength / 1024} KiB chunks`;
            it(description, () => {
                const start = performance.now();

                for (let i = 0; i < test.iterations; ++i) {
                    const chunker = new UnreliableUnorderedChunker(42, test.message, test.chunkLength);
                    for (const _ of chunker) {}
                }

                const end = performance.now();
                console.info(description, `Took ${(end - start) / 1000} seconds`);
                expect(0).toBe(0);
            });
        }
    });
});

describe('Unchunker performance', () => {
    describe('reliable/ordered (with reused buffer)', () => {
        for (const test of tests) {
            const chunks = test.reliableOrderedChunks;
            const description = `${chunks.length} x ~${test.chunkLength / 1024} KiB chunks into ` +
                `${test.iterations} x ${test.messageLength / 1048576} MiB messages`;
            it(description, (done) => {
                const unchunker = new ReliableOrderedUnchunker(new ArrayBuffer(test.chunkLength));
                let reassembledCount = 0;
                unchunker.onMessage = () => {
                    if (++reassembledCount === test.iterations) {
                        const end = performance.now();
                        console.info(description, `Took ${(end - start) / 1000} seconds`);
                        expect(0).toBe(0);
                        done();
                    }
                };

                const start = performance.now();

                for (let i = 0; i < test.iterations; ++i) {
                    for (const chunk of chunks) {
                        unchunker.add(chunk);
                    }
                }
            });
        }
    });

    describe('reliable/ordered (without reused buffer)', () => {
        for (const test of tests) {
            const chunks = test.reliableOrderedChunks;
            const description = `${chunks.length} x ~${test.chunkLength / 1024} KiB chunks into ` +
                `${test.iterations} x ${test.messageLength / 1048576} MiB messages`;
            it(description, (done) => {
                const unchunker = new ReliableOrderedUnchunker();
                let reassembledCount = 0;
                unchunker.onMessage = () => {
                    if (++reassembledCount === test.iterations) {
                        const end = performance.now();
                        console.info(description, `Took ${(end - start) / 1000} seconds`);
                        expect(0).toBe(0);
                        done();
                    }
                };

                const start = performance.now();

                for (let i = 0; i < test.iterations; ++i) {
                    for (const chunk of chunks) {
                        unchunker.add(chunk);
                    }
                }
            });
        }
    });

    describe('unreliable/unordered (with ordered chunks)', () => {
        for (const test of tests) {
            const chunks = test.unreliableUnorderedChunks;  // unreliable/unordered (chunks are ordered)
            const description = `${chunks.length} x ~${test.chunkLength / 1024} KiB chunks into ` +
                `${test.iterations} x ${test.messageLength / 1048576} MiB messages`;
            it(description, (done) => {
                const unchunker = new UnreliableUnorderedUnchunker();
                let reassembledCount = 0;
                unchunker.onMessage = () => {
                    if (++reassembledCount === test.iterations) {
                        const end = performance.now();
                        console.info(description, `Took ${(end - start) / 1000} seconds`);
                        expect(0).toBe(0);
                        done();
                    }
                };

                const start = performance.now();

                for (let i = 0; i < test.iterations; ++i) {
                    for (const chunk of chunks) {
                        unchunker.add(chunk);
                    }
                }
            });
        }
    });

    describe('unreliable/unordered (with unordered chunks)', () => {
        for (const test of tests) {
            // unreliable/unordered (chunks are deterministically shuffled)
            const chunks = test.shuffledUnreliableUnorderedChunks;
            const description = `${chunks.length} x ~${test.chunkLength / 1024} KiB chunks into ` +
                `${test.iterations} x ${test.messageLength / 1048576} MiB messages`;
            it(description, (done) => {
                const unchunker = new UnreliableUnorderedUnchunker();
                let reassembledCount = 0;
                unchunker.onMessage = () => {
                    if (++reassembledCount === test.iterations) {
                        const end = performance.now();
                        console.info(description, `Took ${(end - start) / 1000} seconds`);
                        expect(0).toBe(0);
                        done();
                    }
                };

                const start = performance.now();

                for (let i = 0; i < test.iterations; ++i) {
                    for (const chunk of chunks) {
                        unchunker.add(chunk);
                    }
                }
            });
        }
    });
});
