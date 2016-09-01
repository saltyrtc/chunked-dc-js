/// <reference path="jasmine.d.ts" />
/// <reference path="../chunked-dc.d.ts" />

var counter = 1;
beforeEach(() => console.info('------ TEST', counter++, 'BEGIN ------'));

describe('Chunker', function() {

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

});