/// <reference path="jasmine.d.ts" />

import { MODE_BITMASK } from '../src/common';
import { RELIABLE_ORDERED_HEADER_LENGTH, UNRELIABLE_UNORDERED_HEADER_LENGTH, Mode } from '../src/main';

export default () => { describe('Common', function() {
    it('exposes RELIABLE_ORDERED_HEADER_LENGTH', () => {
        expect(RELIABLE_ORDERED_HEADER_LENGTH).toEqual(1);
    });

    it('exposes UNRELIABLE_UNORDERED_HEADER_LENGTH', () => {
        expect(UNRELIABLE_UNORDERED_HEADER_LENGTH).toEqual(9);
    });

    it('exposes Mode', () => {
        expect(Mode.ReliableOrdered).toEqual(6);
        expect(Mode.UnreliableUnordered).toEqual(0);
    });

    it('modes are detected as defined by the spec', () => {
        expect(255 & MODE_BITMASK).toEqual(Mode.ReliableOrdered);
        expect(249 & MODE_BITMASK).toEqual(Mode.UnreliableUnordered);
    });
})};
