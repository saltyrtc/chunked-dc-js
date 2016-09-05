/// <reference path="jasmine.d.ts" />
/// <reference path="../chunked-dc.d.ts" />

export default () => { describe('Chunker', function() {

    const MORE = 0;
    const END = 1;

    const ID = 42;

    it('chunkifies multiples of the chunk size', () => {
        const arr = Uint8Array.of(1, 2, 3, 4, 5, 6);
        const chunker = new chunkedDc.Chunker(ID, arr, 2);
        expect(chunker.next())
            .toEqual(Uint8Array.of(MORE, /*Id*/0,0,0,ID, /*Serial*/0,0,0,0, /*Data*/1,2));
        expect(chunker.next())
            .toEqual(Uint8Array.of(MORE, /*Id*/0,0,0,ID, /*Serial*/0,0,0,1, /*Data*/3,4));
        expect(chunker.next())
            .toEqual(Uint8Array.of(END, /*Id*/0,0,0,ID, /*Serial*/0,0,0,2, /*Data*/5,6));
        expect(chunker.next()).toBeNull();
    });

    it('chunkifies non-multiples of the chunk size', () => {
        const arr = Uint8Array.of(1, 2, 3, 4, 5, 6);
        const chunker = new chunkedDc.Chunker(ID, arr, 4);
        expect(chunker.next())
            .toEqual(Uint8Array.of(MORE, /*Id*/0,0,0,ID, /*Serial*/0,0,0,0, /*Data*/1,2,3,4));
        expect(chunker.next())
            .toEqual(Uint8Array.of(END, /*Id*/0,0,0,ID, /*Serial*/0,0,0,1, /*Data*/5,6));
        expect(chunker.next()).toBeNull();
    });

    it('chunkifies data smaller than chunk size', () => {
        const arr = Uint8Array.of(1, 2);
        const chunker = new chunkedDc.Chunker(ID, arr, 99);
        expect(chunker.next())
            .toEqual(Uint8Array.of(END, /*Id*/0,0,0,ID, /*Serial*/0,0,0,0, /*Data*/1,2));
        expect(chunker.next()).toBeNull();
    });

    it('allows chunk size of 1', () => {
        const arr = Uint8Array.of(1, 2);
        const chunker = new chunkedDc.Chunker(ID, arr, 1);
        expect(chunker.next())
            .toEqual(Uint8Array.of(MORE, /*Id*/0,0,0,ID, /*Serial*/0,0,0,0, /*Data*/1));
        expect(chunker.next())
            .toEqual(Uint8Array.of(END, /*Id*/0,0,0,ID, /*Serial*/0,0,0,1, /*Data*/2));
        expect(chunker.next()).toBeNull();
    });

    it('does not allow chunk size of 0', () => {
        const arr = Uint8Array.of(1, 2);
        expect(() => new chunkedDc.Chunker(ID, arr, 0)).toThrowError("Chunk size must be at least 1");
    });

    it('does not allow negative chunk size', () => {
        const arr = Uint8Array.of(1, 2);
        expect(() => new chunkedDc.Chunker(ID, arr, -2)).toThrowError("Chunk size must be at least 1");
    });

    it('does not allow chunking of empty arrays', () => {
        const arr = new Uint8Array(0);
        expect(() => new chunkedDc.Chunker(ID, arr, 2)).toThrowError("Array may not be empty");
    });

    it('does not allow out-of-bounds id', () => {
        const arr = Uint8Array.of(1, 2);
        expect(() => new chunkedDc.Chunker(2**32, arr, 2)).toThrowError("Message id must be between 0 and 2**32-1");
        expect(() => new chunkedDc.Chunker(-1, arr, 2)).toThrowError("Message id must be between 0 and 2**32-1");
    });

})};