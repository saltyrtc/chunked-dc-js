declare namespace chunkedDC {
    enum MessageType {
        string = 0b00,
        bytes = 0b01
    }

    interface ChunkedMessage {
        type: MessageType;
        mtu: number;
        pack(): ArrayBuffer;
        unpack(chunk: ArrayBuffer): {type: chunkedDC.MessageType, chunk: ArrayBuffer, id?: number, sequenceNumber?: number};
    }

    interface OrderedChunkedMessage extends ChunkedMessage {}

    interface UnorderedChunkedMessage extends ChunkedMessage {
        id: number;
        sequenceNumber: number;
    }

    interface ChunkedDataChannel {
        mtu: number;
        ordered: boolean;
        onMessage: (message: string | ArrayBuffer) => void;
        chunkify(message: string | ArrayBuffer): ChunkedMessage;
        unchunkify(chunk: ArrayBuffer): void;
    }
}

abstract class ChunkedMessage {
    public type: chunkedDC.MessageType;
    public mtu: number;
    protected message: ArrayBuffer;
    protected offset: number = 0;
    protected headerLength: number;

    public constructor(message: string | ArrayBuffer, mtu: number) {
        if (typeof(message) === 'string') {
            this.type = chunkedDC.MessageType.string;
            // TODO: Convert to ArrayBuffer
            throw 'TODO: Convert to ArrayBuffer';
        } else {
            this.type = chunkedDC.MessageType.bytes;
        }
        this.mtu = mtu - this.headerLength;
        this.message = message;
    }

    public pack(): ArrayBuffer {
        // Calculate remaining length
        const remainingLength = this.message.byteLength - this.offset;
        if (remainingLength == 0) {
            return null;
        }

        // Determine chunk length and whether there are more chunks
        let chunkLength: number;
        let moreChunks: boolean;
        if (remainingLength > this.mtu) {
            moreChunks = true;
            chunkLength = this.mtu;
        } else {
            moreChunks = false;
            chunkLength = remainingLength;
        }

        // Pack header and copy chunk data
        const buffer = new Uint8Array(1 + this.headerLength + chunkLength);
        const view = new DataView(buffer);
        this.packOptions(view, moreChunks);
        this.packHeader(view, moreChunks);
        const chunk = this.message.slice(this.offset, this.offset + chunkLength);
        buffer.set(chunk, this.headerLength);

        // Update offset
        this.offset += chunkLength;

        return buffer;
    }

    public static unpack(chunk: ArrayBuffer, ordered: boolean): {type: chunkedDC.MessageType, eom: boolean, chunk: ArrayBuffer, id?: number, sequenceNumber?: number} {
        // Unpack header and chunk data
        throw 'TODO';
    }

    protected packOptions(view: DataView, moreChunks: boolean, offset: number = 0) {
        // Set end-of-message flag
        let options = moreChunks ? 0b0 : 0b1;

        // Set type
        options |= this.type << 6;

        // Copy to buffer
        view.setUint8(offset, options);
    }

    protected static unpackOptions(view: DataView, ordered: boolean): {type: chunkedDC.MessageType, eom: boolean} {
        throw 'TODO';
    }

    protected abstract packHeader(view: DataView);
    protected abstract unpackHeader(view: DataView);

    protected static unpackHeader(view: DataView, ordered: boolean): {id?: number, sequenceNumber?: number} {
        if (ordered) {
            return OrderedChunkedMessage.unpackHeader(view);
        } else {
            return UnorderedChunkedMessage.unpackHeader(view);
        }
    }
}

class OrderedChunkedMessage extends ChunkedMessage implements chunkedDC.OrderedChunkedMessage {
    protected headerLength: number = 0;

    protected packHeader(view: DataView) {}
    protected static unpackHeader(view: DataView): {} {}
}

class UnorderedChunkedMessage extends ChunkedMessage implements chunkedDC.UnorderedChunkedMessage {
    public id: number;
    public sequenceNumber: number = 0;
    protected headerLength: number = 8;

    public constructor(message: string | ArrayBuffer, mtu: number, id: number) {
        super(message, mtu);
        this.id = id;
    }

    protected packHeader(view: DataView) {
        // Set ID and sequence number
        view.setUint32(1, this.id);
        view.setUint32(5, this.sequenceNumber);

        // Update sequence number
        this.sequenceNumber += 1;
    }

    protected static unpackHeader(view: DataView) {
        throw 'TODO';
    }
}

export class ChunkedDataChannel implements chunkedDC.ChunkedDataChannel {
    public mtu: number;
    public ordered: boolean;
    public onMessage: (message: string | ArrayBuffer) => void = null;
    protected messageId: number = 0;
    protected chunks: Array<string | ArrayBuffer> | {};

    public constructor(ordered: boolean, mtu: number) {
        this.mtu = mtu;
        this.ordered = ordered;

        // Use Array (ordered) or a hash map (unordered)
        if (this.ordered) {
            this.chunks = [];
        } else {
            this.chunks = {};
        }
    }

    public chunkify(message: string | ArrayBuffer): ChunkedMessage {
        if (this.ordered) {
            return new OrderedChunkedMessage(message, this.mtu);
        } else {
            this.messageId += 1;
            return new UnorderedChunkedMessage(message, this.mtu, this.messageId);
        }
    }

    public unchunkify(chunk: ArrayBuffer) {
        if (this.ordered) {
            this.unchunkifyOrdered(chunk);
        } else {
            this.unchunkifyUnordered(chunk);
        }
    }

    protected unchunkifyOrdered(chunk: ArrayBuffer) {

    }

    protected unchunkifyUnordered(chunk: ArrayBuffer) {
        throw 'TODO';
    }
}
