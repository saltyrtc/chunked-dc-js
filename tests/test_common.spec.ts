/// <reference path="jasmine.d.ts" />

import { HEADER_LENGTH } from '../src/main';

export default () => { describe('Common', function() {

    it('exposes HEADER_LENGTH', () => {
        expect(HEADER_LENGTH).toEqual(9);
    });

})};
