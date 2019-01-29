/**
 * Copyright (C) 2016-2019 Threema GmbH / SaltyRTC Contributors
 *
 * Licensed under the Apache License, Version 2.0, <see LICENSE-APACHE file>
 * or the MIT license <see LICENSE-MIT file>, at your option. This file may not be
 * copied, modified, or distributed except according to those terms.
 */
import '../node_modules/@babel/polyfill/dist/polyfill'; // Include ES5 polyfills
export {
    ReliableOrderedChunker, UnreliableUnorderedChunker,
    ReliableOrderedUnchunker, UnreliableUnorderedUnchunker,
    UNRELIABLE_UNORDERED_HEADER_LENGTH, RELIABLE_ORDERED_HEADER_LENGTH, Mode
} from './main';
