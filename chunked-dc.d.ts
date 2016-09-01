// Interfaces
declare namespace chunkedDc {

    /** common.ts **/

    interface CommonStatic {
        HEADER_LENGTH: number;
    }

    /** chunker.ts **/

    interface Chunker {
        next(): Uint8Array;
    }

    interface ChunkerStatic {
        new(id: number, buf: Uint8Array, chunkSize: number): Chunker
    }

    /** main.ts **/

    interface Standalone {
        Chunker: ChunkerStatic,
    }

}

// Entry point
declare var chunkedDc: chunkedDc.Standalone;