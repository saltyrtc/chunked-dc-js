// Interfaces
declare namespace chunkedDc {

    /** common.ts **/

    interface CommonStatic {
        HEADER_LENGTH: number;
    }

    /** chunker.ts **/

    interface BlobChunker extends IterableIterator<Blob> {
        hasNext: boolean;
        next(): IteratorResult<Blob>;
        [Symbol.iterator](): IterableIterator<Blob>;
    }

    interface Uint8ArrayChunker extends IterableIterator<Uint8Array> {
        hasNext: boolean;
        next(): IteratorResult<Uint8Array>;
        [Symbol.iterator](): IterableIterator<Uint8Array>;
    }

    interface BlobChunkerStatic {
        new(id: number, message: Uint8Array, chunkSize: number): BlobChunker
    }

    interface Uint8ArrayChunkerStatic {
        new(id: number, message: Uint8Array, chunkSize: number): Uint8ArrayChunker
    }

    /** unchunker.ts **/

    type BlobMessageListener = (message: Blob, context?: any) => void;
    type Uint8ArrayMessageListener = (message: Uint8Array, context?: any) => void;

    interface BlobUnchunker {
        onMessage: BlobMessageListener;
        add(chunk: Blob, context?: any): void;
        gc(maxAge: number): number;
    }

    interface Uint8ArrayUnchunker {
        onMessage: Uint8ArrayMessageListener;
        add(chunk: ArrayBuffer, context?: any): void;
        gc(maxAge: number): number;
    }

    interface BlobUnchunkerStatic {
        new(): BlobUnchunker
    }

    interface Uint8ArrayUnchunkerStatic {
        new(): Uint8ArrayUnchunker
    }

    /** main.ts **/

    interface Standalone {
        BlobChunker: BlobChunkerStatic,
        Uint8ArrayChunker: Uint8ArrayChunkerStatic,
        BlobUnchunker: BlobUnchunkerStatic,
        Uint8ArrayUnchunker: Uint8ArrayUnchunkerStatic,
    }

}

// Entry point
declare var chunkedDc: chunkedDc.Standalone;