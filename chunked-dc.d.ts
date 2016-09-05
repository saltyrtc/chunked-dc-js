// Interfaces
declare namespace chunkedDc {

    /** common.ts **/

    interface CommonStatic {
        HEADER_LENGTH: number;
    }

    /** chunker.ts **/

    interface Chunker extends IterableIterator<Uint8Array> {
        hasNext: boolean;
        next(): IteratorResult<Uint8Array>;
        [Symbol.iterator](): IterableIterator<Uint8Array>;
    }

    interface ChunkerStatic {
        new(id: number, message: Uint8Array, chunkSize: number): Chunker
    }

    /** unchunker.ts **/

    type MessageListener = (message: Uint8Array) => void;

    interface Unchunker {
        onMessage: MessageListener;
        add(chunk: ArrayBuffer): void;
        gc(maxAge: number): number;
    }

    interface UnchunkerStatic {
        new(): Unchunker
    }

    /** main.ts **/

    interface Standalone {
        Chunker: ChunkerStatic,
        Unchunker: UnchunkerStatic,
    }

}

// Entry point
declare var chunkedDc: chunkedDc.Standalone;