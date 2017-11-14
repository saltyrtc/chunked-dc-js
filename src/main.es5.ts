/**
 * Copyright (C) 2017 Threema GmbH / SaltyRTC Contributors
 *
 * Licensed under the Apache License, Version 2.0, <see LICENSE-APACHE file>
 * or the MIT license <see LICENSE-MIT file>, at your option. This file may not be
 * copied, modified, or distributed except according to those terms.
 */
import "../node_modules/babel-es6-polyfill/browser-polyfill"; // Include ES5 polyfills
export { Chunker, BlobChunker, Uint8ArrayChunker,
         Unchunker, BlobUnchunker, Uint8ArrayUnchunker } from "./main";
