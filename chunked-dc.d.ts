// Interfaces
declare namespace chunkedDc {
    /** common.ts **/

    interface Mode {
        ReliableOrdered: number;
        UnreliableUnordered: number;
    }

    /** chunker.ts **/

    interface Chunker extends IterableIterator<Uint8Array> {
        hasNext: boolean;
        next(): IteratorResult<Uint8Array>;
        [Symbol.iterator](): IterableIterator<Uint8Array>;
    }

    interface ReliableOrderedChunker extends Chunker {}

    interface ReliableOrderedChunkerStatic {
        new(message: Uint8Array, chunkLength: number, buffer?: ArrayBuffer): ReliableOrderedChunker;
    }

    interface UnreliableUnorderedChunker extends Chunker {}

    interface UnreliableUnorderedChunkerStatic {
        new(id: number, message: Uint8Array, chunkLength: number, buffer?: ArrayBuffer): UnreliableUnorderedChunker;
    }

    /** unchunker.ts **/

    type MessageListener = (message: Uint8Array, context?: any) => void;

    interface Unchunker {
        onMessage: MessageListener;
        add(chunk: Uint8Array): void;
    }

    interface ReliableOrderedUnchunker extends Unchunker {}

    interface ReliableOrderedUnchunkerStatic {
        new(buffer?: ArrayBuffer): ReliableOrderedUnchunker;
    }

    interface UnreliableUnorderedUnchunker extends Unchunker {
        gc(maxAge: number): number;
    }

    interface UnreliableUnorderedUnchunkerStatic {
        new(): UnreliableUnorderedUnchunker;
    }

    /** main.ts **/

    interface Standalone {
        Mode: Mode,
        RELIABLE_ORDERED_HEADER_LENGTH: number;
        UNRELIABLE_UNORDERED_HEADER_LENGTH: number;
        ReliableOrderedChunker: ReliableOrderedChunkerStatic;
        UnreliableUnorderedChunker: UnreliableUnorderedChunkerStatic;
        ReliableOrderedUnchunker: ReliableOrderedUnchunkerStatic;
        UnreliableUnorderedUnchunker: UnreliableUnorderedUnchunkerStatic;
    }
}

// Entry point
declare var chunkedDc: chunkedDc.Standalone;
