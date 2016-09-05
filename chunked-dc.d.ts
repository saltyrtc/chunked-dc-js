// Interfaces
declare namespace chunkedDc {

    /** common.ts **/

    interface CommonStatic {
        HEADER_LENGTH: number;
    }

    /** chunker.ts **/

    interface Chunker {
        next(): Uint8Array;
        hasNext(): boolean;
    }

    interface ChunkerStatic {
        new(id: number, message: Uint8Array, chunkSize: number): Chunker
    }

    /** unchunker.ts **/

    type MessageListener = (Uint8Array) => void;

    interface Unchunker {
        add(chunk: ArrayBuffer): void;
        onMessage: MessageListener;
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