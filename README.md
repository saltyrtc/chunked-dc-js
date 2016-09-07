# Binary Chunking for WebRTC DataChannels

[![Travis branch](https://img.shields.io/travis/saltyrtc/chunked-dc-js/master.svg)](https://travis-ci.org/saltyrtc/chunked-dc-js)
[![Supported ES Standard](https://img.shields.io/badge/javascript-ES5%2B-orange.svg)](https://github.com/saltyrtc/chunked-dc-js)
[![License](https://img.shields.io/badge/license-MIT%20%2F%20Apache%202.0-blue.svg)](https://github.com/saltyrtc/chunked-dc-js)
[![Version](https://img.shields.io/github/tag/saltyrtc/chunked-dc-js.svg)](https://github.com/saltyrtc/chunked-dc-js/releases)

This library allows you to split up large binary messages into
multiple chunks of a certain size.

When converting data to chunks, a 9 byte header is prepended
to each chunk. This allows you to send the chunks to the
receiver in any order.

While the library was written for use with WebRTC
DataChannels, it can also be used outside of that scope.

## Installing

If you're writing a browser application, simply use the normal or minified ES5
or ES2015 distribution from the `dist` directory.

    <script src="chunked-dc.es2015.min.js"></script>

The ES5 versions are considerably larger because they also contain polyfills.

All classes are namespaced under `chunkedDc`:

- `chunkedDc.Chunker`
- `chunkedDc.Unchunker`

An npm release is pending (#12).

To build the distributions yourself, simply run `npm install && npm run dist`
in the main directory.

## Usage

### Chunking

For each message that you want to split into chunks, pass it to a `Chunker`.

```javascript
let messageId = 1337;
let message = Uint8Array.of(1, 2, 3, 4, 5);
let chunkSize = 2; // Chunk size *excluding* header
let chunker = new Chunker(messageId, message.buffer, chunkSize);
```

You can then process all chunks using the iterator/iterable protocol:

```javascript
for (let chunk of chunker) {
    // Send chunk to peer
}
```

Alternatively you can also use the `next()` method directly:

```javascript
while (chunker.hasNext) {
    let chunk = chunker.next().value;
    // Send chunk to peer
}
```

The example above will return 3 chunks (header prefix not shown): `[1, 2], [3, 4], [5]`.

### Unchunking

This library works both if chunks are sent in ordered or unordered manner.
Because ordering is not guaranteed, the Unchunker instance accepts chunks and
stores them in an internal data structure. As soon as all chunks of a message
have arrived, a listener will be notified. Repeated chunks with the same serial
will be ignored.

Create the Unchunker instance:

```javascript
let unchunker = new Unchunker();
```

Register a message listener:

```javascript
unchunker.onMessage = (message: Uint8Array, context: any[]) => {
    // Do something with the received message
};
```

Finally, when new chunks arrive, simply add them to the `Unchunker` instance:

```
let chunk = ...; // ArrayBuffer
unchunker.add(chunk);
```

You may also pass some context object to the unchunker which will be stored
together with the chunk. When the `onMessage` handler is notified, these
context objects will be passed in as a list ordered by chunk serial.

### Cleanup

Because the `Unchunker` instance needs to keep track of arrived chunks, it's
possible that incomplete messages add up and use a lot of memory without ever
being freed.

To avoid this, simply call the `Unchunker.gc(maxAge: number)` method regularly.
It will remove all incomplete messages that haven't been updated for more than
`maxAge` milliseconds.

## Format

A chunker instance splits up an `Uint8Array` into multiple chunks.

A header is added to each chunk:

    |O|IIII|SSSS|

    - O: Options bitfield (1 byte)
    - I: Id (4 bytes)
    - S: Serial number (4 bytes)

The options bitfield looks as follows:

    |000000E|
           ^---- End-of-message

The Id can be any number, but it's recommended to start at 0 and
increment the counter for each message.

The Serial must start at 0 and be incremented after every message.

No chunk may contain more bytes than the first one.

## Testing

This library has an extensive test suite. To run it:

    npm install
    npm run build

Then open `tests.html` in your browser to run the test suite.

## Type Declarations

If you use TypeScript, simply reference the `chunked-dc.d.ts` type declaration
file to get type checking and autocompletion.

## License

    Copyright (c) 2016 Threema GmbH / SaltyRTC Contributors
    
    Licensed under the Apache License, Version 2.0, <see LICENSE-APACHE file>
    or the MIT license <see LICENSE-MIT file>, at your option. This file may not be
    copied, modified, or distributed except according to those terms.
