# Binary Chunking for WebRTC DataChannels

This library allows you to split up large binary messages into multiple chunks
of a certain size.

When converting data to chunks, a 9 byte header is prepended to each chunk.
This allows you to send the chunks to the receiver in any order.

While the library was written for use with WebRTC DataChannels, it can also be
used outside of that scope.

## Usage

### Initialization

```typescript
let ordered = false;
let mtu = 16000;
let cdc = ChunkedDataChannel(ordered, mtu);
```

### Chunking

```typescript
let data = new Uint8Array([1, 2, 3, 4, 5]);
let msg = cdc.chunkify(data.buffer);
while(true) {
    let chunk: ArrayBuffer = msg.pack();
    if (chunk === null) {
        break;
    } else {
        dataChannel.send(chunk);
    }
}
```

### Unchunking

```typescript
TBD
```
