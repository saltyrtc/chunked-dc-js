/**
 * Copyright (C) 2016-2021 Threema GmbH / SaltyRTC Contributors
 *
 * Licensed under the Apache License, Version 2.0, <see LICENSE-APACHE file>
 * or the MIT license <see LICENSE-MIT file>, at your option. This file may not be
 * copied, modified, or distributed except according to those terms.
 */

export const RELIABLE_ORDERED_HEADER_LENGTH = 1;
export const UNRELIABLE_UNORDERED_HEADER_LENGTH = 9;

/**
 * The mode being used when chunking/unchunking.
 */
export const MODE_BITMASK = 6;
export const enum Mode {
    // Important: Changes to the values must correspond to the options field!

    // R R R R R 1 1 E
    ReliableOrdered = 6,
    // R R R R R 0 0 E
    UnreliableUnordered = 0,
}
