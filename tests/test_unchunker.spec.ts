/// <reference path="jasmine.d.ts" />
/// <reference path="../chunked-dc.d.ts" />

import {Unchunker, BlobUnchunker, Uint8ArrayUnchunker} from "../src/main";

/**
 * A wrapper around the unchunker that stores finished messages in a list.
 */
class LoggingUnchunker {
    public messages: any[] = [];
    constructor(unchunker: Unchunker) {
        unchunker.onMessage = (message: any) => {
            this.messages.push(message);
        }
    }
}

/**
 * Fisher-Yates shuffle function.
 * http://stackoverflow.com/a/2450976/284318
 */
function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}

export default () => { describe('Unchunker', function() {

    const MORE = 0;
    const END = 1;
    const ID = 42;

    const unchunkerVariants = [
        {
            name: 'BlobUnchunker',
            createBuffer: (data) => new Blob([new Uint8Array(data)]),
            createUnchunker: (...args) => {
                const object = Object.create(BlobUnchunker.prototype);
                BlobUnchunker.apply(object, args);
                return object;
            },
        }, {
            name: 'Uint8ArrayUnchunker',
            createBuffer: (data) => new Uint8Array(data),
            createUnchunker: (...args) => {
                const object = Object.create(Uint8ArrayUnchunker.prototype);
                Uint8ArrayUnchunker.apply(object, args);
                return object;
            },
        },
    ];

    unchunkerVariants.forEach((unchunkerVariant) => {
        describe(unchunkerVariant.name, () => {
            describe('base', () => {
                it('unchunkifies regular messages', async() => {
                    const unchunker = unchunkerVariant.createUnchunker();
                    const logger = new LoggingUnchunker(unchunker);

                    expect(logger.messages.length).toEqual(0);

                    await unchunker.add(unchunkerVariant.createBuffer([MORE, 0, 0, 0, ID, 0, 0, 0, 0, 1, 2, 3]));
                    await unchunker.add(unchunkerVariant.createBuffer([MORE, 0, 0, 0, ID, 0, 0, 0, 1, 4, 5, 6]));
                    await unchunker.add(unchunkerVariant.createBuffer([END, 0, 0, 0, ID, 0, 0, 0, 2, 7, 8]));

                    expect(logger.messages.length).toEqual(1);
                    expect(logger.messages[0]).toEqual(unchunkerVariant.createBuffer([1, 2, 3, 4, 5, 6, 7, 8]));
                });

                it('unchunkifies single-chunk messages', async() => {
                    const unchunker = unchunkerVariant.createUnchunker();
                    const logger = new LoggingUnchunker(unchunker);

                    expect(logger.messages.length).toEqual(0);

                    await unchunker.add(unchunkerVariant.createBuffer([END, 0, 0, 0, ID, 0, 0, 0, 0, 7, 7, 7]));

                    expect(logger.messages.length).toEqual(1);
                    expect(logger.messages[0]).toEqual(unchunkerVariant.createBuffer([7, 7, 7]));
                });

                it('unchunkifies empty single-chunk messages', async() => {
                    const unchunker = unchunkerVariant.createUnchunker();
                    const logger = new LoggingUnchunker(unchunker);

                    expect(logger.messages.length).toEqual(0);

                    await unchunker.add(unchunkerVariant.createBuffer([END, 0, 0, 0, ID, 0, 0, 0, 0]));

                    expect(logger.messages.length).toEqual(1);
                    expect(logger.messages[0]).toEqual(unchunkerVariant.createBuffer([]));
                });

                it('unchunkifies multiple messages in parallel', async() => {
                    const unchunker = unchunkerVariant.createUnchunker();
                    const logger = new LoggingUnchunker(unchunker);

                    expect(logger.messages.length).toEqual(0);

                    await unchunker.add(unchunkerVariant.createBuffer([MORE, 0, 0, 0, ID, 0, 0, 0, 0, 1, 2]));
                    await unchunker.add(unchunkerVariant.createBuffer([MORE, 0, 0, 0, ID + 1, 0, 0, 0, 0, 3, 4]));
                    await unchunker.add(unchunkerVariant.createBuffer([END, 0, 0, 0, ID, 0, 0, 0, 1, 5, 6]));
                    expect(logger.messages.length).toEqual(1);
                    await unchunker.add(unchunkerVariant.createBuffer([END, 0, 0, 0, ID + 1, 0, 0, 0, 1, 7, 8]));
                    expect(logger.messages.length).toEqual(2);
                    expect(logger.messages[0]).toEqual(unchunkerVariant.createBuffer([1, 2, 5, 6]));
                    expect(logger.messages[1]).toEqual(unchunkerVariant.createBuffer([3, 4, 7, 8]));
                });

                it('supports out of order messages', async() => {
                    const unchunker = unchunkerVariant.createUnchunker();
                    const logger = new LoggingUnchunker(unchunker);

                    await unchunker.add(unchunkerVariant.createBuffer([MORE, 0, 0, 0, ID, 0, 0, 0, 1, 3, 4]));
                    await unchunker.add(unchunkerVariant.createBuffer([MORE, 0, 0, 0, ID, 0, 0, 0, 0, 1, 2]));
                    await unchunker.add(unchunkerVariant.createBuffer([END, 0, 0, 0, ID, 0, 0, 0, 3, 7, 8]));

                    expect(logger.messages.length).toEqual(0);

                    await unchunker.add(unchunkerVariant.createBuffer([MORE, 0, 0, 0, ID, 0, 0, 0, 2, 5, 6]));

                    expect(logger.messages.length).toEqual(1);
                    expect(logger.messages[0]).toEqual(unchunkerVariant.createBuffer([1, 2, 3, 4, 5, 6, 7, 8]));
                });

                it('does not notify listeners for incomplete messages', async() => {
                    const unchunker = unchunkerVariant.createUnchunker();
                    const logger = new LoggingUnchunker(unchunker);

                    // End chunk with serial 1, no chunk with serial 0
                    await unchunker.add(unchunkerVariant.createBuffer([END, 0, 0, 0, ID, 0, 0, 0, 1, 7, 7, 7]));

                    expect(logger.messages.length).toEqual(0);
                });

                it('does not accept invalid chunks', async() => {
                    const unchunker = unchunkerVariant.createUnchunker();
                    try {
                        await unchunker.add(unchunkerVariant.createBuffer([1, 2, 3]));
                        fail('Should error!');
                    } catch (err) {
                        expect(err.message).toEqual('Invalid chunk: Too short');
                    }
                });

                it('does not accept empty first chunks', async() => {
                    const unchunker = unchunkerVariant.createUnchunker();

                    await unchunker.add(unchunkerVariant.createBuffer([MORE, 0, 0, 0, ID, 0, 0, 0, 0]));
                    await unchunker.add(unchunkerVariant.createBuffer([MORE, 0, 0, 0, ID, 0, 0, 0, 1, 1, 2]));
                    try {
                        await unchunker.add(unchunkerVariant.createBuffer([END, 0, 0, 0, ID, 0, 0, 0, 2, 3]));
                        fail('Should error!');
                    } catch (err) {
                        expect(err.message).toEqual('No chunk may be larger than the first chunk of that message.');
                    }
                });

                it('ignores repeated chunks with the same serial', async() => {
                    const unchunker = unchunkerVariant.createUnchunker();
                    const logger = new LoggingUnchunker(unchunker);

                    await unchunker.add(unchunkerVariant.createBuffer([MORE, 0, 0, 0, ID, 0, 0, 0, 0, 1, 2]));
                    await unchunker.add(unchunkerVariant.createBuffer([MORE, 0, 0, 0, ID, 0, 0, 0, 0, 3, 4]));
                    await unchunker.add(unchunkerVariant.createBuffer([END, 0, 0, 0, ID, 0, 0, 0, 1, 5, 6]));

                    expect(logger.messages.length).toEqual(1);
                    expect(logger.messages[0]).toEqual(unchunkerVariant.createBuffer([1, 2, 5, 6]));
                });

                it('ignores end chunks with the same serial', async() => {
                    const unchunker = unchunkerVariant.createUnchunker();
                    const logger = new LoggingUnchunker(unchunker);

                    await unchunker.add(unchunkerVariant.createBuffer([MORE, 0, 0, 0, ID, 0, 0, 0, 0, 1, 2]));
                    await unchunker.add(unchunkerVariant.createBuffer([END, 0, 0, 0, ID, 0, 0, 0, 0, 3, 4]));
                    await unchunker.add(unchunkerVariant.createBuffer([END, 0, 0, 0, ID, 0, 0, 0, 1, 5, 6]));

                    expect(logger.messages.length).toEqual(1);
                    expect(logger.messages[0]).toEqual(unchunkerVariant.createBuffer([1, 2, 5, 6]));
                });

                it('does not break if there\'s no listener registered', async() => {
                    const unchunker = unchunkerVariant.createUnchunker();
                    let error = null;
                    try {
                        await unchunker.add(unchunkerVariant.createBuffer([END, 0, 0, 0, ID, 0, 0, 0, 0, 1, 2, 3]));
                    } catch (err) {
                        error = err.message;
                    }
                    expect(error).toEqual(null);
                });

                it('notifies listeners that have been added after receiving some msgs', async() => {
                    const unchunker = unchunkerVariant.createUnchunker();

                    await unchunker.add(unchunkerVariant.createBuffer([MORE, 0, 0, 0, ID, 0, 0, 0, 0, 1, 2]));
                    await unchunker.add(unchunkerVariant.createBuffer([MORE, 0, 0, 0, ID, 0, 0, 0, 1, 3, 4]));

                    // Add listener only after two chunks have arrived
                    const logger = new LoggingUnchunker(unchunker);
                    await unchunker.add(unchunkerVariant.createBuffer([END, 0, 0, 0, ID, 0, 0, 0, 2, 5, 6]));

                    expect(logger.messages.length).toEqual(1);
                    expect(logger.messages[0]).toEqual(unchunkerVariant.createBuffer([1, 2, 3, 4, 5, 6]));
                });

                it('can handle non-awaited adds', async() => {
                    const unchunker = unchunkerVariant.createUnchunker();
                    const logger = new LoggingUnchunker(unchunker);
                    let promises = [];

                    expect(logger.messages.length).toEqual(0);

                    promises.push(unchunker.add(unchunkerVariant.createBuffer([MORE, 0, 0, 0, ID, 0, 0, 0, 0, 1, 2, 3])));
                    promises.push(unchunker.add(unchunkerVariant.createBuffer([MORE, 0, 0, 0, ID, 0, 0, 0, 1, 4, 5, 6])));
                    promises.push(unchunker.add(unchunkerVariant.createBuffer([END, 0, 0, 0, ID, 0, 0, 0, 2, 7, 8])));
                    await Promise.all(promises);

                    expect(logger.messages.length).toEqual(1);
                    expect(logger.messages[0]).toEqual(unchunkerVariant.createBuffer([1, 2, 3, 4, 5, 6, 7, 8]));
                });
            });

            describe('cleanup', () => {
                it('supports garbage collection', async(done) => {
                    const unchunker = unchunkerVariant.createUnchunker();
                    expect(unchunker.gc(1000)).toEqual(0);
                    await unchunker.add(unchunkerVariant.createBuffer([MORE, 0, 0, 0, 1, 0, 0, 0, 0, 1, 2]));
                    await unchunker.add(unchunkerVariant.createBuffer([MORE, 0, 0, 0, 1, 0, 0, 0, 1, 3, 4]));
                    await unchunker.add(unchunkerVariant.createBuffer([MORE, 0, 0, 0, 2, 0, 0, 0, 0, 1, 2]));
                    setTimeout(() => {
                        expect(unchunker.gc(1000)).toEqual(0);
                        expect(unchunker.gc(10)).toEqual(3);
                        expect(unchunker.gc(10)).toEqual(0);
                        done();
                    }, 20);
                }, 1200);
            });

            describe('context', () => {
                it('passes an empty context list to the handler by default', async(done) => {
                    const unchunker = unchunkerVariant.createUnchunker();
                    unchunker.onMessage = (message: any, context: any[]) => {
                        expect(context).toEqual([]);
                        done();
                    };
                    await unchunker.add(unchunkerVariant.createBuffer([MORE, 0, 0, 0, ID, 0, 0, 0, 0, 1, 2]));
                    await unchunker.add(unchunkerVariant.createBuffer([END, 0, 0, 0, ID, 0, 0, 0, 2, 5, 6]));
                    await unchunker.add(unchunkerVariant.createBuffer([MORE, 0, 0, 0, ID, 0, 0, 0, 1, 3, 4]));
                });

                it('passes sorted context objects to the handler', async(done) => {
                    const unchunker = unchunkerVariant.createUnchunker();
                    unchunker.onMessage = (message: any, context: any[]) => {
                        expect(context).toEqual([1, 2, 3]);
                        done();
                    };
                    await unchunker.add(unchunkerVariant.createBuffer([MORE, 0, 0, 0, ID, 0, 0, 0, 0, 1, 2]), 1);
                    await unchunker.add(unchunkerVariant.createBuffer([END, 0, 0, 0, ID, 0, 0, 0, 2, 5, 6]), 3);
                    await unchunker.add(unchunkerVariant.createBuffer([MORE, 0, 0, 0, ID, 0, 0, 0, 1, 3, 4]), 2);
                });

                it('passes single-chunk context objects to the handler', async(done) => {
                    const unchunker = unchunkerVariant.createUnchunker();
                    unchunker.onMessage = (message: any, context: any[]) => {
                        expect(context).toEqual([42]);
                        done();
                    };
                    await unchunker.add(unchunkerVariant.createBuffer([END, 0, 0, 0, ID, 0, 0, 0, 0, 1, 2, 3]), 42);
                });

                it('only passes defined context objects to the handler', async(done) => {
                    const unchunker = unchunkerVariant.createUnchunker();
                    unchunker.onMessage = (message: any, context: any[]) => {
                        expect(context).toEqual([1, 3]);
                        done();
                    };
                    await unchunker.add(unchunkerVariant.createBuffer([END, 0, 0, 0, ID, 0, 0, 0, 2, 5, 6]), 3);
                    await unchunker.add(unchunkerVariant.createBuffer([MORE, 0, 0, 0, ID, 0, 0, 0, 0, 1, 2]), 1);
                    await unchunker.add(unchunkerVariant.createBuffer([MORE, 0, 0, 0, ID, 0, 0, 0, 1, 3, 4]));
                });
            });

            describe('integration', () => {
                it('passes an integration test', async() => {
                    const unchunker = unchunkerVariant.createUnchunker();
                    const logger = new LoggingUnchunker(unchunker);

                    expect(logger.messages.length).toEqual(0);

                    // Chunks in random order
                    const chunks = [
                        // 1
                        unchunkerVariant.createBuffer([MORE, 0, 0, 0, 1, 0, 0, 0, 0, 1, 2]),
                        unchunkerVariant.createBuffer([END, 0, 0, 0, 1, 0, 0, 0, 1, 3, 4]),
                        // 2
                        unchunkerVariant.createBuffer([END, 0, 0, 0, 2, 0, 0, 0, 0, 5]),
                        // 3
                        unchunkerVariant.createBuffer([MORE, 0, 0, 0, 3, 0, 0, 0, 0, 6, 7, 8]),
                        unchunkerVariant.createBuffer([MORE, 0, 0, 0, 3, 0, 0, 0, 1, 9, 10, 11]),
                        unchunkerVariant.createBuffer([MORE, 0, 0, 0, 3, 0, 0, 0, 2, 12, 13, 14]),
                        unchunkerVariant.createBuffer([END, 0, 0, 0, 3, 0, 0, 0, 3, 15]),
                        // Incomplete
                        unchunkerVariant.createBuffer([MORE, 0, 0, 0, 4, 0, 0, 0, 0, 23, 42])
                    ];
                    shuffle(chunks);

                    for (let chunk of chunks) {
                        await unchunker.add(chunk);
                    }
                    expect(logger.messages.length).toEqual(3);
                    expect(logger.messages).toContain(unchunkerVariant.createBuffer([1, 2, 3, 4]));
                    expect(logger.messages).toContain(unchunkerVariant.createBuffer([5]));
                    expect(logger.messages).toContain(unchunkerVariant.createBuffer([6, 7, 8, 9, 10, 11, 12, 13, 14, 15]));
                });
            });
        });
    });

})};
