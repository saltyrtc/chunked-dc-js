# Binary Chunking for WebRTC DataChannels

[![CircleCI](https://circleci.com/gh/saltyrtc/chunked-dc-js/tree/master.svg?style=shield)](https://circleci.com/gh/saltyrtc/chunked-dc-js/tree/master)
[![Supported ES Standard](https://img.shields.io/badge/javascript-ES5%20%2F%20ES2015-yellow.svg)](https://github.com/saltyrtc/chunked-dc-js)
[![npm Version](https://img.shields.io/npm/v/@saltyrtc/chunked-dc.svg?maxAge=86400)](https://www.npmjs.com/package/@saltyrtc/chunked-dc)
[![npm Downloads](https://img.shields.io/npm/dt/@saltyrtc/chunked-dc.svg?maxAge=86400)](https://www.npmjs.com/package/@saltyrtc/chunked-dc)
[![License](https://img.shields.io/badge/license-MIT%20%2F%20Apache%202.0-blue.svg)](https://github.com/saltyrtc/chunked-dc-js)

This library allows you to split up large binary messages into multiple
chunks of a certain size.

It allows you to choose between the following two modes:

* **Reliable/Ordered**: Intended for reliable and ordered transmission
  of chunks. Chunks may not be reordered and chunks of different
  messages may not be interleaved.
* **Unreliable/Unordered**: Intended for transmission of chunks where
  chunks may be lost or reordered. **Important**: Duplication of chunks
  is not allowed by this implementation.

While the library was originally written for use with WebRTC
DataChannels, it can also be used outside of that scope.

The full specification for the chunking wire format can be found
[here](https://github.com/saltyrtc/saltyrtc-meta/blob/master/Chunking.md).


## Installing

If you're writing a browser application, use the normal or minified ES5
distribution from the `dist` directory.

    <script src="chunked-dc.es5.min.polyfill.js"></script>

If you have a build pipeline yourself, you may also want to use the ES2015
version instead. The ES5 polyfill version is considerably larger because it
also contains ES5 polyfills.

Alternatively, install the library via `npm`:

    npm install --save @saltyrtc/chunked-dc

All classes in the ES5 version are namespaced under `chunkedDc`:

- `chunkedDc.ReliableOrderedChunker`
- `chunkedDc.ReliableOrderedUnchunker`
- `chunkedDc.UnreliableUnorderedChunker`
- `chunkedDc.UnreliableUnorderedUnchunker`
- ...

To build the distributions yourself, run `npm install && npm run dist` in the
main directory.


## Usage

### Reliable/Ordered

#### Chunking

For each message that you want to split into chunks, pass it to a
`ReliableOrderedChunker`.

```javascript
const messageId = 1337;
const message = Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8);
const chunkLength = 4; // Chunk byte length *including* 1 byte header
const buffer = new ArrayBuffer(chunkSize);
const chunker = new ReliableOrderedChunker(message, chunkLength, buffer);
```

The `buffer` is optional. If supplied, the chunker can continuously reuse the
buffer as temporary chunk storage. While this increases performance, each chunk
retrieved from the chunker needs to be processed or copied before a next chunk
can be safely retrieved.

You can then retrieve chunks using the iterator/iterable protocol:

```javascript
for (const chunk of chunker) {
    // Send chunk to peer
}
```

Alternatively you can also use the `next()` method directly:

```javascript
while (chunker.hasNext) {
    const chunk = chunker.next().value;
    // Transmit chunk to peer who is unchunking
}
```

The example above will return 3 chunks (header prefix not shown):
`[1, 2, 3], [4, 5, 6], [7, 8]`.

#### Unchunking

The `ReliableOrderedUnchunker` adds ordered chunks into a contiguous buffer. As
soon as all chunks of a message have been added, a listener will be notified.

Create the `ReliableOrderedUnchunker` instance:

```javascript
const buffer = new ArrayBuffer(128);
const unchunker = new ReliableOrderedUnchunker(buffer);
```

The `buffer` is optional. If supplied, it will be continuously used for
reassembling messages. If the message grows larger than `buffer`, the buffer will be
replaced. Supplying a `buffer` allows for slightly improved performance.
Regardless of whether or not it is being used, each message retrieved needs to
be processed or copied immediately before a next chunk can be added to the
unchunker.

Register a message listener:

```javascript
unchunker.onMessage = (message: Uint8Array) => {
    // Do something with the received message
};
```

Finally, when new chunks arrive, add them to the unchunker instance:

```
let chunk = ...; // Uint8Array
unchunker.add(chunk);
```

### Unreliable/Unordered

The unreliable/unordered mode usage is very similar to the
[reliable/ordered](#reliableordered) mode. We will only mention differences
regarding usage.

#### Chunking

You can create an `UnreliableUnorderedChunker` in the following way:

```javascript
const messageId = 1337;
const message = Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8);
const chunkLength = 12; // Chunk byte length *including* 9 byte header
const buffer = new ArrayBuffer(chunkSize);
const chunker = new UnreliableUnorderedChunker(
    messageId, message, chunkLength, buffer);
```

Retrieving chunks is identical to the [reliable/ordered](#reliableordered)
mode.

#### Unchunking

This mode works both if chunks are sent in ordered or unordered manner. Because
ordering is not guaranteed, the unchunker accepts chunks and stores them in an
internal data structure. As soon as all chunks of a message have arrived, a
listener will be notified.

Create the `UnreliableUnorderedUnchunker` instance:

```javascript
let unchunker = new UnreliableUnorderedUnchunker();
```

Registering a message listener and adding chunks is identical to the
[reliable/ordered](#reliableordered) mode.

#### Cleanup

Because the `UnreliableUnorderedUnchunker` instance needs to keep track of
arrived chunks, it is possible that incomplete messages add up and use a lot of
memory without ever being freed.

To avoid this, call the `UnreliableUnorderedUnchunker.gc(maxAge: number)`
method regularly. It will remove all incomplete messages that haven't been
updated for more than `maxAge` milliseconds.

### Constants

This library exposes the following constants:

- `RELIABLE_ORDERED_HEADER_LENGTH`: The number of bytes in the chunk header for
  reliable/ordered mode.
- `UNRELIABLE_UNORDERED_HEADER_LENGTH`: The number of bytes in the chunk header
  for unreliable/unordered mode.
- `Mode` contains a mapping to each mode which can be applied on the *options's
  bit field* as defined by the chunking wire format.


## Type Declarations

If you use TypeScript, simply reference the `chunked-dc.d.ts` type
declaration file to get type checking and autocompletion.


## Testing

This library has an extensive test suite. To run it:

    npm install
    npm run rollup_tests

Then open `tests.html` in your browser to run the test suite.


## Performance

You can run the performance test suite to retrieve results for your local
browser:

    npm install
    npm run rollup_tests

Then open `performance.html?random=false` in your browser to run the
performance tests.


## Linting

To run linting checks:

    npm run lint

You can also install a pre-push hook to do the linting:

    echo -e '#!/bin/sh\nnpm run lint' > .git/hooks/pre-push
    chmod +x .git/hooks/pre-push


## License

    Copyright (c) 2016-2019 Threema GmbH
    
    Licensed under the Apache License, Version 2.0, <see LICENSE-APACHE file>
    or the MIT license <see LICENSE-MIT file>, at your option. This file may not be
    copied, modified, or distributed except according to those terms.
