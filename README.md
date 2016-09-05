# Binary Chunking for WebRTC DataChannels

This library allows you to split up large binary messages into
multiple chunks of a certain size.

When converting data to chunks, a 9 byte header is prepended
to each chunk. This allows you to send the chunks to the
receiver in any order.

While the library was written for use with WebRTC
DataChannels, it can also be used outside of that scope.

# Usage

## Chunking

For each message that you want to split into chunks, pass it to a `Chunker`.

```javascript
let messageId = 1337;
let message = Uint8Array.of(1, 2, 3, 4, 5);
let chunkSize = 2;
let chunker = new Chunker(messageId, message.buffer, chunkSize);
```

You can then process all chunks:

```javascript
while (chunker.hasNext()) {
    let chunk = chunker.next();
    // Send chunk to peer
}
```

The example above will return 3 chunks: `[1, 2], [3, 4], [5]`.

## Unchunking

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
unchunker.onMessage = (message: Uint8Array) => {
    // Do something with the received message
};
```

Finally, when new chunks arrive, simply add them to the `Unchunker` instance:

```
let chunk = ...; // ArrayBuffer
unchunker.add(chunk);
```

## Format

A chunker instance splits up an `Uint8Array` into multiple chunks.

A header is added to each chunk:

    |C|IIII|SSSS|

    - C: Configuration bitfield (1 byte)
    - I: Id (4 bytes)
    - S: Serial number (4 bytes)

The configuration bitfield looks as follows:

    |000000E|
           ^---- End-of-message

The Id can be any number, but it's recommended to start at 0 and
increment the counter for each message.

The Serial must start at 0 and be incremented after every message.

No chunk may contain more bytes than the first one.

# Testing

This library has an extensive test suite. To run it:

    npm install
    npm run build

Then open `tests.html` in your browser to run the test suite.
