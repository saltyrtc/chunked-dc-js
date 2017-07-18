/// <reference path="jasmine.d.ts" />
/// <reference path="../chunked-dc.d.ts" />

import {Unchunker} from "../src/main";

/**
 * A wrapper around the unchunker that stores finished messages in a list.
 */
class LoggingUnchunker {
    public messages: Uint8Array[] = [];
    constructor(unchunker: Unchunker) {
        unchunker.onMessage = (message: Uint8Array) => {
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

    describe('base', () => {

        it('unchunkifies regular messages', () => {
            const unchunker = new Unchunker();
            const logger = new LoggingUnchunker(unchunker);

            expect(logger.messages.length).toEqual(0);

            unchunker.add(Uint8Array.of(MORE, 0, 0, 0, ID, 0, 0, 0, 0, 1, 2, 3).buffer);
            unchunker.add(Uint8Array.of(MORE, 0, 0, 0, ID, 0, 0, 0, 1, 4, 5, 6).buffer);
            unchunker.add(Uint8Array.of(END, 0, 0, 0, ID, 0, 0, 0, 2, 7, 8).buffer);

            expect(logger.messages.length).toEqual(1);
            expect(logger.messages[0]).toEqual(Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8));
        });

        it('unchunkifies single-chunk messages', () => {
            const unchunker = new Unchunker();
            const logger = new LoggingUnchunker(unchunker);

            expect(logger.messages.length).toEqual(0);

            unchunker.add(Uint8Array.of(END, 0, 0, 0, ID, 0, 0, 0, 0, 7, 7, 7).buffer);

            expect(logger.messages.length).toEqual(1);
            expect(logger.messages[0]).toEqual(Uint8Array.of(7, 7, 7));
        });

        it('unchunkifies empty single-chunk messages', () => {
            const unchunker = new Unchunker();
            const logger = new LoggingUnchunker(unchunker);

            expect(logger.messages.length).toEqual(0);

            unchunker.add(Uint8Array.of(END, 0, 0, 0, ID, 0, 0, 0, 0).buffer);

            expect(logger.messages.length).toEqual(1);
            expect(logger.messages[0]).toEqual(new Uint8Array(0));
        });

        it('unchunkifies multiple messages in parallel', () => {
            const unchunker = new Unchunker();
            const logger = new LoggingUnchunker(unchunker);

            expect(logger.messages.length).toEqual(0);

            unchunker.add(Uint8Array.of(MORE, 0, 0, 0, ID, 0, 0, 0, 0, 1, 2).buffer);
            unchunker.add(Uint8Array.of(MORE, 0, 0, 0, ID + 1, 0, 0, 0, 0, 3, 4).buffer);
            unchunker.add(Uint8Array.of(END, 0, 0, 0, ID, 0, 0, 0, 1, 5, 6).buffer);
            expect(logger.messages.length).toEqual(1);
            unchunker.add(Uint8Array.of(END, 0, 0, 0, ID + 1, 0, 0, 0, 1, 7, 8).buffer);
            expect(logger.messages.length).toEqual(2);
            expect(logger.messages[0]).toEqual(Uint8Array.of(1, 2, 5, 6));
            expect(logger.messages[1]).toEqual(Uint8Array.of(3, 4, 7, 8));
        });

        it('supports out of order messages', () => {
            const unchunker = new Unchunker();
            const logger = new LoggingUnchunker(unchunker);

            unchunker.add(Uint8Array.of(MORE, 0, 0, 0, ID, 0, 0, 0, 1, 3, 4).buffer);
            unchunker.add(Uint8Array.of(MORE, 0, 0, 0, ID, 0, 0, 0, 0, 1, 2).buffer);
            unchunker.add(Uint8Array.of(END, 0, 0, 0, ID, 0, 0, 0, 3, 7, 8).buffer);

            expect(logger.messages.length).toEqual(0);

            unchunker.add(Uint8Array.of(MORE, 0, 0, 0, ID, 0, 0, 0, 2, 5, 6).buffer);

            expect(logger.messages.length).toEqual(1);
            expect(logger.messages[0]).toEqual(Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8));
        });

        it('does not notify listeners for incomplete messages', () => {
            const unchunker = new Unchunker();
            const logger = new LoggingUnchunker(unchunker);

            // End chunk with serial 1, no chunk with serial 0
            unchunker.add(Uint8Array.of(END, 0, 0, 0, ID, 0, 0, 0, 1, 7, 7, 7).buffer);

            expect(logger.messages.length).toEqual(0);
        });

        it('does not accept invalid chunks', () => {
            const unchunker = new Unchunker();
            const add = () => unchunker.add(Uint8Array.of(1, 2, 3).buffer);
            expect(add).toThrowError('Invalid chunk: Too short');
        });

        it('does not accept empty first chunks', () => {
            const unchunker = new Unchunker();

            unchunker.add(Uint8Array.of(MORE, 0, 0, 0, ID, 0, 0, 0, 0).buffer);
            unchunker.add(Uint8Array.of(MORE, 0, 0, 0, ID, 0, 0, 0, 1, 1, 2).buffer);
            const finalize = () => unchunker.add(Uint8Array.of(END, 0, 0, 0, ID, 0, 0, 0, 2, 3).buffer);
            expect(finalize).toThrowError('No chunk may be larger than the first chunk of that message.');
        });

        it('ignores repeated chunks with the same serial', () => {
            const unchunker = new Unchunker();
            const logger = new LoggingUnchunker(unchunker);

            unchunker.add(Uint8Array.of(MORE, 0, 0, 0, ID, 0, 0, 0, 0, 1, 2).buffer);
            unchunker.add(Uint8Array.of(MORE, 0, 0, 0, ID, 0, 0, 0, 0, 3, 4).buffer);
            unchunker.add(Uint8Array.of(END, 0, 0, 0, ID, 0, 0, 0, 1, 5, 6).buffer);

            expect(logger.messages.length).toEqual(1);
            expect(logger.messages[0]).toEqual(Uint8Array.of(1, 2, 5, 6));
        });

        it('ignores end chunks with the same serial', () => {
            const unchunker = new Unchunker();
            const logger = new LoggingUnchunker(unchunker);

            unchunker.add(Uint8Array.of(MORE, 0, 0, 0, ID, 0, 0, 0, 0, 1, 2).buffer);
            unchunker.add(Uint8Array.of(END, 0, 0, 0, ID, 0, 0, 0, 0, 3, 4).buffer);
            unchunker.add(Uint8Array.of(END, 0, 0, 0, ID, 0, 0, 0, 1, 5, 6).buffer);

            expect(logger.messages.length).toEqual(1);
            expect(logger.messages[0]).toEqual(Uint8Array.of(1, 2, 5, 6));
        });

        it('does not break if there\'s no listener registered', () => {
            const unchunker = new Unchunker();
            const add = () => unchunker.add(Uint8Array.of(END, 0, 0, 0, ID, 0, 0, 0, 0, 1, 2, 3).buffer);
            expect(add).not.toThrowError();
        });

        it('notifies listeners that have been added after receiving some msgs', () => {
            const unchunker = new Unchunker();

            unchunker.add(Uint8Array.of(MORE, 0, 0, 0, ID, 0, 0, 0, 0, 1, 2).buffer);
            unchunker.add(Uint8Array.of(MORE, 0, 0, 0, ID, 0, 0, 0, 1, 3, 4).buffer);

            // Add listener only after two chunks have arrived
            const logger = new LoggingUnchunker(unchunker);
            unchunker.add(Uint8Array.of(END, 0, 0, 0, ID, 0, 0, 0, 2, 5, 6).buffer);

            expect(logger.messages.length).toEqual(1);
            expect(logger.messages[0]).toEqual(Uint8Array.of(1, 2, 3, 4, 5, 6));
        });

    });

    describe('cleanup', () => {

        it('supports garbage collection', async(done) => {
            const unchunker = new Unchunker();
            expect(unchunker.gc(1000)).toEqual(0);
            unchunker.add(Uint8Array.of(MORE, 0, 0, 0, 1, 0, 0, 0, 0, 1, 2).buffer);
            unchunker.add(Uint8Array.of(MORE, 0, 0, 0, 1, 0, 0, 0, 1, 3, 4).buffer);
            unchunker.add(Uint8Array.of(MORE, 0, 0, 0, 2, 0, 0, 0, 0, 1, 2).buffer);
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
            const unchunker = new Unchunker();
            unchunker.onMessage = (message: Uint8Array, context: any[]) => {
                expect(context).toEqual([]);
                done();
            };
            unchunker.add(Uint8Array.of(MORE, 0, 0, 0, ID, 0, 0, 0, 0, 1, 2).buffer);
            unchunker.add(Uint8Array.of(END, 0, 0, 0, ID, 0, 0, 0, 2, 5, 6).buffer);
            unchunker.add(Uint8Array.of(MORE, 0, 0, 0, ID, 0, 0, 0, 1, 3, 4).buffer);
        });

        it('passes sorted context objects to the handler', async(done) => {
            const unchunker = new Unchunker();
            unchunker.onMessage = (message: Uint8Array, context: any[]) => {
                expect(context).toEqual([1, 2, 3]);
                done();
            };
            unchunker.add(Uint8Array.of(MORE, 0, 0, 0, ID, 0, 0, 0, 0, 1, 2).buffer, 1);
            unchunker.add(Uint8Array.of(END, 0, 0, 0, ID, 0, 0, 0, 2, 5, 6).buffer, 3);
            unchunker.add(Uint8Array.of(MORE, 0, 0, 0, ID, 0, 0, 0, 1, 3, 4).buffer, 2);
        });

        it('passes single-chunk context objects to the handler', async(done) => {
            const unchunker = new Unchunker();
            unchunker.onMessage = (message: Uint8Array, context: any[]) => {
                expect(context).toEqual([42]);
                done();
            };
            unchunker.add(Uint8Array.of(END, 0, 0, 0, ID, 0, 0, 0, 0, 1, 2, 3).buffer, 42);
        });

        it('only passes defined context objects to the handler', async(done) => {
            const unchunker = new Unchunker();
            unchunker.onMessage = (message: Uint8Array, context: any[]) => {
                expect(context).toEqual([1, 3]);
                done();
            };
            unchunker.add(Uint8Array.of(END, 0, 0, 0, ID, 0, 0, 0, 2, 5, 6).buffer, 3);
            unchunker.add(Uint8Array.of(MORE, 0, 0, 0, ID, 0, 0, 0, 0, 1, 2).buffer, 1);
            unchunker.add(Uint8Array.of(MORE, 0, 0, 0, ID, 0, 0, 0, 1, 3, 4).buffer);
        });

    });

    describe('transform', () => {

        it('applies transformation function to chunks', () => {
            function increment(data: Uint8Array) {
                return data.map(x => x + 1);
            }

            const unchunker = new Unchunker(increment);
            const logger = new LoggingUnchunker(unchunker);

            expect(logger.messages.length).toEqual(0);

            unchunker.add(Uint8Array.of(MORE, 0, 0, 0, ID, 0, 0, 0, 0, 1, 2, 3).buffer);
            unchunker.add(Uint8Array.of(MORE, 0, 0, 0, ID, 0, 0, 0, 1, 4, 5, 6).buffer);
            unchunker.add(Uint8Array.of(END, 0, 0, 0, ID, 0, 0, 0, 2, 7, 8).buffer);

            expect(logger.messages.length).toEqual(1);
            expect(logger.messages[0]).toEqual(Uint8Array.of(2, 3, 4, 5, 6, 7, 8, 9));
        });

    });

    describe('integration', () => {

        it('passes an integration test', () => {
            const unchunker = new Unchunker();
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
                unchunker.add(chunk.buffer);
            }
            expect(logger.messages.length).toEqual(3);
            expect(logger.messages).toContain(Uint8Array.of(1, 2, 3, 4));
            expect(logger.messages).toContain(Uint8Array.of(5));
            expect(logger.messages).toContain(Uint8Array.of(6, 7, 8, 9, 10, 11, 12, 13, 14, 15));
        });

    });

})};
