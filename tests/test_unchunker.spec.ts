/// <reference path="jasmine.d.ts" />
/// <reference path="../chunked-dc.d.ts" />

import { ReliableOrderedUnchunker, UnreliableUnorderedUnchunker } from '../src/main';

/**
 * A wrapper around an unchunker that stores finished messages in a list.
 */
class LoggingUnchunker {
    public messages: Uint8Array[] = [];
    constructor(unchunker: chunkedDc.Unchunker) {
        unchunker.onMessage = (message: Uint8Array) => {
            this.messages.push(message.slice());
        }
    }
}

/**
 * Fisher-Yates shuffle function.
 * http://stackoverflow.com/a/2450976/284318
 */
function shuffle(array) {
    let currentIndex = array.length, temporaryValue, randomIndex;

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

export default () => {
    describe('ReliableOrderedUnchunker', function() {
        const MORE = 6;
        const END = 7;

        const tests: Array<ArrayBuffer | undefined> = [new ArrayBuffer(128), undefined];

        for (const buffer of tests) {
            const hasBufferStr = buffer !== undefined ? 'yes' : 'no';

            describe(`base (buffer=${hasBufferStr})`, () => {
                it('unchunkifies regular messages', () => {
                    const unchunker = new ReliableOrderedUnchunker(buffer);
                    const logger = new LoggingUnchunker(unchunker);

                    expect(logger.messages.length).toEqual(0);

                    unchunker.add(Uint8Array.of(MORE, 1, 2, 3));
                    unchunker.add(Uint8Array.of(MORE, 4, 5, 6));
                    unchunker.add(Uint8Array.of(END, 7, 8));

                    expect(logger.messages.length).toEqual(1);
                    expect(logger.messages[0]).toEqual(Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8));
                });

                it('unchunkifies single-chunk messages', () => {
                    const unchunker = new ReliableOrderedUnchunker(buffer);
                    const logger = new LoggingUnchunker(unchunker);

                    expect(logger.messages.length).toEqual(0);

                    unchunker.add(Uint8Array.of(END, 7, 7, 7));

                    expect(logger.messages.length).toEqual(1);
                    expect(logger.messages[0]).toEqual(Uint8Array.of(7, 7, 7));
                });

                it('unchunkifies empty chunk messages', () => {
                    const unchunker = new ReliableOrderedUnchunker(buffer);
                    const logger = new LoggingUnchunker(unchunker);

                    expect(logger.messages.length).toEqual(0);

                    unchunker.add(Uint8Array.of(END));

                    expect(logger.messages.length).toEqual(1);
                    expect(logger.messages[0]).toEqual(new Uint8Array(0));
                });

                it('unchunkifies multiple empty chunk messages', () => {
                    const unchunker = new ReliableOrderedUnchunker(buffer);
                    const logger = new LoggingUnchunker(unchunker);

                    expect(logger.messages.length).toEqual(0);

                    unchunker.add(Uint8Array.of(MORE));
                    unchunker.add(Uint8Array.of(MORE, 1, 2));
                    unchunker.add(Uint8Array.of(END, 3));

                    expect(logger.messages.length).toEqual(1);
                    expect(logger.messages[0]).toEqual(Uint8Array.of(1, 2, 3));
                });

                it('does not notify listeners for incomplete messages', () => {
                    const unchunker = new ReliableOrderedUnchunker(buffer);
                    const logger = new LoggingUnchunker(unchunker);

                    unchunker.add(Uint8Array.of(MORE, 7, 7, 7));

                    expect(logger.messages.length).toEqual(0);
                });

                it('does not accept invalid chunks', () => {
                    const unchunker = new ReliableOrderedUnchunker(buffer);
                    const add = () => unchunker.add(new Uint8Array(0));
                    expect(add).toThrowError('Invalid chunk: Too short');
                });

                it('notifies listeners that have been added after receiving some msgs', () => {
                    const unchunker = new ReliableOrderedUnchunker(buffer);

                    unchunker.add(Uint8Array.of(MORE, 1, 2));
                    unchunker.add(Uint8Array.of(MORE, 3, 4));

                    // Add listener only after two chunks have arrived
                    const logger = new LoggingUnchunker(unchunker);
                    unchunker.add(Uint8Array.of(END, 5, 6));

                    expect(logger.messages.length).toEqual(1);
                    expect(logger.messages[0]).toEqual(Uint8Array.of(1, 2, 3, 4, 5, 6));
                });

                it('does not accept invalid mode', () => {
                    const unchunker = new ReliableOrderedUnchunker();
                    const add = () => unchunker.add(Uint8Array.of(0));
                    expect(add).toThrowError('Invalid chunk: Unexpected mode 0');
                });

                it('does not accept reserved mode', () => {
                    const unchunker = new ReliableOrderedUnchunker();
                    const add = () => unchunker.add(Uint8Array.of(2));
                    expect(add).toThrowError('Invalid chunk: Unexpected mode 2');
                });
            });

            describe(`integration (buffer=${hasBufferStr})`, () => {
                it('passes 300 messages', () => {
                    const unchunker = new ReliableOrderedUnchunker(buffer);

                    for (const _ of Array(100).keys()) {
                        const logger = new LoggingUnchunker(unchunker);

                        expect(logger.messages.length).toEqual(0);

                        const chunks = [
                            // 1
                            Uint8Array.of(MORE, 1, 2),
                            Uint8Array.of(END, 3, 4),
                            // 2
                            Uint8Array.of(END, 5),
                            // 3
                            Uint8Array.of(MORE, 6, 7, 8),
                            Uint8Array.of(MORE, 9, 10, 11),
                            Uint8Array.of(MORE, 12, 13, 14),
                            Uint8Array.of(END, 15),
                        ];

                        for (let chunk of chunks) {
                            unchunker.add(chunk);
                        }
                        expect(logger.messages.length).toEqual(3);
                        expect(logger.messages).toContain(Uint8Array.of(1, 2, 3, 4));
                        expect(logger.messages).toContain(Uint8Array.of(5));
                        expect(logger.messages).toContain(Uint8Array.of(6, 7, 8, 9, 10, 11, 12, 13, 14, 15));
                    }
                });
            });
        }
    });

    describe('UnreliableUnorderedUnchunker', function() {
        const MORE = 0;
        const END = 1;
        const ID = 42;

        describe('base', () => {
            it('unchunkifies regular messages', () => {
                const unchunker = new UnreliableUnorderedUnchunker();
                const logger = new LoggingUnchunker(unchunker);

                expect(logger.messages.length).toEqual(0);

                unchunker.add(Uint8Array.of(MORE, 0, 0, 0, ID, 0, 0, 0, 0, 1, 2, 3));
                unchunker.add(Uint8Array.of(MORE, 0, 0, 0, ID, 0, 0, 0, 1, 4, 5, 6));
                unchunker.add(Uint8Array.of(END, 0, 0, 0, ID, 0, 0, 0, 2, 7, 8));

                expect(logger.messages.length).toEqual(1);
                expect(logger.messages[0]).toEqual(Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8));
            });

            it('unchunkifies single-chunk messages', () => {
                const unchunker = new UnreliableUnorderedUnchunker();
                const logger = new LoggingUnchunker(unchunker);

                expect(logger.messages.length).toEqual(0);

                unchunker.add(Uint8Array.of(END, 0, 0, 0, ID, 0, 0, 0, 0, 7, 7, 7));

                expect(logger.messages.length).toEqual(1);
                expect(logger.messages[0]).toEqual(Uint8Array.of(7, 7, 7));
            });

            it('unchunkifies empty chunk messages', () => {
                const unchunker = new UnreliableUnorderedUnchunker();
                const logger = new LoggingUnchunker(unchunker);

                expect(logger.messages.length).toEqual(0);

                unchunker.add(Uint8Array.of(END, 0, 0, 0, ID, 0, 0, 0, 0));

                expect(logger.messages.length).toEqual(1);
                expect(logger.messages[0]).toEqual(new Uint8Array(0));
            });

            it('unchunkifies multiple empty chunk messages', () => {
                const unchunker = new UnreliableUnorderedUnchunker();
                const logger = new LoggingUnchunker(unchunker);

                expect(logger.messages.length).toEqual(0);

                unchunker.add(Uint8Array.of(MORE, 0, 0, 0, ID, 0, 0, 0, 0));
                unchunker.add(Uint8Array.of(MORE, 0, 0, 0, ID, 0, 0, 0, 1, 1, 2));
                unchunker.add(Uint8Array.of(END, 0, 0, 0, ID, 0, 0, 0, 2, 3));

                expect(logger.messages.length).toEqual(1);
                expect(logger.messages[0]).toEqual(Uint8Array.of(1, 2, 3));
            });

            it('unchunkifies multiple messages in parallel', () => {
                const unchunker = new UnreliableUnorderedUnchunker();
                const logger = new LoggingUnchunker(unchunker);

                expect(logger.messages.length).toEqual(0);

                unchunker.add(Uint8Array.of(MORE, 0, 0, 0, ID, 0, 0, 0, 0, 1, 2));
                unchunker.add(Uint8Array.of(MORE, 0, 0, 0, ID + 1, 0, 0, 0, 0, 3, 4));
                unchunker.add(Uint8Array.of(END, 0, 0, 0, ID, 0, 0, 0, 1, 5, 6));
                expect(logger.messages.length).toEqual(1);
                unchunker.add(Uint8Array.of(END, 0, 0, 0, ID + 1, 0, 0, 0, 1, 7, 8));
                expect(logger.messages.length).toEqual(2);
                expect(logger.messages[0]).toEqual(Uint8Array.of(1, 2, 5, 6));
                expect(logger.messages[1]).toEqual(Uint8Array.of(3, 4, 7, 8));
            });

            it('supports out of order messages', () => {
                const unchunker = new UnreliableUnorderedUnchunker();
                const logger = new LoggingUnchunker(unchunker);

                unchunker.add(Uint8Array.of(MORE, 0, 0, 0, ID, 0, 0, 0, 1, 3, 4));
                unchunker.add(Uint8Array.of(MORE, 0, 0, 0, ID, 0, 0, 0, 0, 1, 2));
                unchunker.add(Uint8Array.of(END, 0, 0, 0, ID, 0, 0, 0, 3, 7, 8));

                expect(logger.messages.length).toEqual(0);

                unchunker.add(Uint8Array.of(MORE, 0, 0, 0, ID, 0, 0, 0, 2, 5, 6));

                expect(logger.messages.length).toEqual(1);
                expect(logger.messages[0]).toEqual(Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8));
            });

            it('does not notify listeners for incomplete messages', () => {
                const unchunker = new UnreliableUnorderedUnchunker();
                const logger = new LoggingUnchunker(unchunker);

                // End chunk with serial 1, no chunk with serial 0
                unchunker.add(Uint8Array.of(END, 0, 0, 0, ID, 0, 0, 0, 1, 7, 7, 7));

                expect(logger.messages.length).toEqual(0);
            });

            it('does not accept invalid chunks', () => {
                const unchunker = new UnreliableUnorderedUnchunker();
                const add = () => unchunker.add(Uint8Array.of(1, 2, 3));
                expect(add).toThrowError('Invalid chunk: Too short');
            });

            it('notifies listeners that have been added after receiving some msgs', () => {
                const unchunker = new UnreliableUnorderedUnchunker();

                unchunker.add(Uint8Array.of(MORE, 0, 0, 0, ID, 0, 0, 0, 0, 1, 2));
                unchunker.add(Uint8Array.of(MORE, 0, 0, 0, ID, 0, 0, 0, 1, 3, 4));

                // Add listener only after two chunks have arrived
                const logger = new LoggingUnchunker(unchunker);
                unchunker.add(Uint8Array.of(END, 0, 0, 0, ID, 0, 0, 0, 2, 5, 6));

                expect(logger.messages.length).toEqual(1);
                expect(logger.messages[0]).toEqual(Uint8Array.of(1, 2, 3, 4, 5, 6));
            });

            it('handles omitted messages', () => {
                const unchunker = new UnreliableUnorderedUnchunker();
                const logger = new LoggingUnchunker(unchunker);

                unchunker.add(Uint8Array.of(MORE, 0, 0, 0, 3, 0, 0, 0, 1, 9, 10, 11));
                unchunker.add(Uint8Array.of(MORE, 0, 0, 0, 1, 0, 0, 0, 0, 1, 2));
                unchunker.add(Uint8Array.of(MORE, 0, 0, 0, 3, 0, 0, 0, 2, 12, 13, 14));
                unchunker.add(Uint8Array.of(MORE, 0, 0, 0, 3, 0, 0, 0, 0, 6, 7, 8));
                unchunker.add(Uint8Array.of(END, 0, 0, 0, 3, 0, 0, 0, 3, 15));

                expect(logger.messages.length).toEqual(1);
                expect(logger.messages).toContain(Uint8Array.of(6, 7, 8, 9, 10, 11, 12, 13, 14, 15));
            });

            it('does not accept invalid mode', () => {
                const unchunker = new UnreliableUnorderedUnchunker();
                const add = () => unchunker.add(Uint8Array.of(6, 0, 0, 0, 0, 1, 1, 1, 1));
                expect(add).toThrowError('Invalid chunk: Unexpected mode 6');
            });

            it('does not accept reserved mode', () => {
                const unchunker = new UnreliableUnorderedUnchunker();
                const add = () => unchunker.add(Uint8Array.of(2, 0, 0, 0, 0, 1, 1, 1, 1));
                expect(add).toThrowError('Invalid chunk: Unexpected mode 2');
            });
        });

        describe('cleanup', () => {
            it('supports garbage collection', async(done) => {
                const unchunker = new UnreliableUnorderedUnchunker();
                expect(unchunker.gc(1000)).toEqual(0);
                unchunker.add(Uint8Array.of(MORE, 0, 0, 0, 1, 0, 0, 0, 0, 1, 2));
                unchunker.add(Uint8Array.of(MORE, 0, 0, 0, 1, 0, 0, 0, 1, 3, 4));
                unchunker.add(Uint8Array.of(MORE, 0, 0, 0, 2, 0, 0, 0, 0, 1, 2));
                setTimeout(() => {
                    expect(unchunker.gc(1000)).toEqual(0);
                    expect(unchunker.gc(10)).toEqual(3);
                    expect(unchunker.gc(10)).toEqual(0);
                    done();
                }, 20);
            }, 1200);

        });

        describe('integration', () => {
            it('passes 100 shuffled integration tests', () => {
                for (const _ of Array(100).keys()) {
                    const unchunker = new UnreliableUnorderedUnchunker();
                    const logger = new LoggingUnchunker(unchunker);

                    expect(logger.messages.length).toEqual(0);

                    // Chunks in random order
                    const chunks = [
                        // 1
                        Uint8Array.of(MORE, 0, 0, 0, 1, 0, 0, 0, 0, 1, 2),
                        Uint8Array.of(END, 0, 0, 0, 1, 0, 0, 0, 1, 3, 4),
                        // 2
                        Uint8Array.of(END, 0, 0, 0, 2, 0, 0, 0, 0, 5),
                        // 3
                        Uint8Array.of(MORE, 0, 0, 0, 3, 0, 0, 0, 0, 6, 7, 8),
                        Uint8Array.of(MORE, 0, 0, 0, 3, 0, 0, 0, 1, 9, 10, 11),
                        Uint8Array.of(MORE, 0, 0, 0, 3, 0, 0, 0, 2, 12, 13, 14),
                        Uint8Array.of(END, 0, 0, 0, 3, 0, 0, 0, 3, 15),
                        // Incomplete
                        Uint8Array.of(MORE, 0, 0, 0, 4, 0, 0, 0, 0, 23, 42)
                    ];
                    shuffle(chunks);

                    for (let chunk of chunks) {
                        unchunker.add(chunk);
                    }
                    expect(logger.messages.length).toEqual(3);
                    expect(logger.messages).toContain(Uint8Array.of(1, 2, 3, 4));
                    expect(logger.messages).toContain(Uint8Array.of(5));
                    expect(logger.messages).toContain(Uint8Array.of(6, 7, 8, 9, 10, 11, 12, 13, 14, 15));
                }
            });
        });
    });
};
