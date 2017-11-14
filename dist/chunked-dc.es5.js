/**
 * chunked-dc v1.0.0
 * Binary chunking for WebRTC data channels & more.
 * https://github.com/saltyrtc/chunked-dc-js#readme
 *
 * Copyright (C) 2017 Threema GmbH
 *
 * Licensed under the Apache License, Version 2.0, <see LICENSE-APACHE file>
 * or the MIT license <see LICENSE-MIT file>, at your option. This file may not be
 * copied, modified, or distributed except according to those terms.
 */

(function (exports) {
'use strict';

function __awaiter(thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
}

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
  return typeof obj;
} : function (obj) {
  return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
};











var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();







var get$1 = function get$1(object, property, receiver) {
  if (object === null) object = Function.prototype;
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent === null) {
      return undefined;
    } else {
      return get$1(parent, property, receiver);
    }
  } else if ("value" in desc) {
    return desc.value;
  } else {
    var getter = desc.get;

    if (getter === undefined) {
      return undefined;
    }

    return getter.call(receiver);
  }
};

var inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
};











var possibleConstructorReturn = function (self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }

  return call && (typeof call === "object" || typeof call === "function") ? call : self;
};



var set = function set(object, property, value, receiver) {
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent !== null) {
      set(parent, property, value, receiver);
    }
  } else if ("value" in desc && desc.writable) {
    desc.value = value;
  } else {
    var setter = desc.set;

    if (setter !== undefined) {
      setter.call(receiver, value);
    }
  }

  return value;
};

var slicedToArray = function () {
  function sliceIterator(arr, i) {
    var _arr = [];
    var _n = true;
    var _d = false;
    var _e = undefined;

    try {
      for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
        _arr.push(_s.value);

        if (i && _arr.length === i) break;
      }
    } catch (err) {
      _d = true;
      _e = err;
    } finally {
      try {
        if (!_n && _i["return"]) _i["return"]();
      } finally {
        if (_d) throw _e;
      }
    }

    return _arr;
  }

  return function (arr, i) {
    if (Array.isArray(arr)) {
      return arr;
    } else if (Symbol.iterator in Object(arr)) {
      return sliceIterator(arr, i);
    } else {
      throw new TypeError("Invalid attempt to destructure non-iterable instance");
    }
  };
}();

var Common = function Common() {
  classCallCheck(this, Common);
};

Common.HEADER_LENGTH = 9;

var Chunker = function () {
    function Chunker(id, message, chunkSize) {
        classCallCheck(this, Chunker);

        this.chunkId = 0;
        if (chunkSize < Common.HEADER_LENGTH + 1) {
            throw new Error("Chunk size must be at least " + (Common.HEADER_LENGTH + 1));
        }
        var length = this.getLength(message);
        if (length < 1) {
            throw new Error("Message may not be empty");
        }
        if (id < 0 || id >= Math.pow(2, 32)) {
            throw new Error("Message id must be between 0 and 2**32-1");
        }
        this.id = id;
        this.message = message;
        this.messageLength = length;
        this.chunkDataSize = chunkSize - Common.HEADER_LENGTH;
    }

    createClass(Chunker, [{
        key: "next",
        value: function next() {
            if (!this.hasNext) {
                return {
                    done: true,
                    value: null
                };
            }
            var currentIndex = this.chunkId * this.chunkDataSize;
            var remaining = this.messageLength - currentIndex;
            var chunkBytes = remaining < this.chunkDataSize ? remaining : this.chunkDataSize;
            var options = remaining > chunkBytes ? 0 : 1;
            var chunk = this.getChunk(currentIndex, chunkBytes, options);
            return {
                done: false,
                value: chunk
            };
        }
    }, {
        key: "nextSerial",
        value: function nextSerial() {
            return this.chunkId++;
        }
    }, {
        key: "writeHeader",
        value: function writeHeader(buffer, options) {
            var id = this.id;
            var serial = this.nextSerial();
            buffer.setUint8(0, options);
            buffer.setUint32(1, id);
            buffer.setUint32(5, serial);
        }
    }, {
        key: Symbol.iterator,
        value: function value() {
            return this;
        }
    }, {
        key: "hasNext",
        get: function get() {
            var currentIndex = this.chunkId * this.chunkDataSize;
            var remaining = this.messageLength - currentIndex;
            return remaining >= 1;
        }
    }]);
    return Chunker;
}();

var BlobChunker = function (_Chunker) {
    inherits(BlobChunker, _Chunker);

    function BlobChunker(id, message, chunkSize) {
        classCallCheck(this, BlobChunker);

        var _this = possibleConstructorReturn(this, (BlobChunker.__proto__ || Object.getPrototypeOf(BlobChunker)).call(this, id, message, chunkSize));

        _this.headerBuffer = new DataView(new ArrayBuffer(Common.HEADER_LENGTH));
        return _this;
    }

    createClass(BlobChunker, [{
        key: "getLength",
        value: function getLength(message) {
            return message.size;
        }
    }, {
        key: "getChunk",
        value: function getChunk(currentIndex, chunkBytes, options) {
            var chunk = this.message.slice(currentIndex, currentIndex + chunkBytes);
            this.writeHeader(this.headerBuffer, options);
            return new Blob([this.headerBuffer, chunk]);
        }
    }]);
    return BlobChunker;
}(Chunker);

var Uint8ArrayChunker = function (_Chunker2) {
    inherits(Uint8ArrayChunker, _Chunker2);

    function Uint8ArrayChunker() {
        classCallCheck(this, Uint8ArrayChunker);
        return possibleConstructorReturn(this, (Uint8ArrayChunker.__proto__ || Object.getPrototypeOf(Uint8ArrayChunker)).apply(this, arguments));
    }

    createClass(Uint8ArrayChunker, [{
        key: "getLength",
        value: function getLength(message) {
            return message.byteLength;
        }
    }, {
        key: "getChunk",
        value: function getChunk(currentIndex, chunkBytes, options) {
            var chunk = new DataView(new ArrayBuffer(chunkBytes + Common.HEADER_LENGTH));
            this.writeHeader(chunk, options);
            for (var i = 0; i < chunkBytes; i++) {
                var offset = Common.HEADER_LENGTH + i;
                chunk.setUint8(offset, this.message[currentIndex + i]);
            }
            return new Uint8Array(chunk.buffer);
        }
    }]);
    return Uint8ArrayChunker;
}(Chunker);

var Chunk = function () {
    function Chunk(buf, length, context) {
        classCallCheck(this, Chunk);

        if (length < Common.HEADER_LENGTH) {
            throw new Error('Invalid chunk: Too short');
        }
        this._length = length;
        this._data = this.getData(buf);
        this._context = context;
    }

    createClass(Chunk, [{
        key: 'readHeader',
        value: function readHeader(reader) {
            var options = reader.getUint8(0);
            this._endOfMessage = (options & 0x01) == 1;
            this._id = reader.getUint32(1);
            this._serial = reader.getUint32(5);
        }
    }, {
        key: 'isEndOfMessage',
        get: function get() {
            return this._endOfMessage;
        }
    }, {
        key: 'id',
        get: function get() {
            return this._id;
        }
    }, {
        key: 'serial',
        get: function get() {
            return this._serial;
        }
    }, {
        key: 'data',
        get: function get() {
            return this._data;
        }
    }, {
        key: 'context',
        get: function get() {
            return this._context;
        }
    }]);
    return Chunk;
}();

var BlobChunk = function (_Chunk) {
    inherits(BlobChunk, _Chunk);

    function BlobChunk() {
        classCallCheck(this, BlobChunk);
        return possibleConstructorReturn(this, (BlobChunk.__proto__ || Object.getPrototypeOf(BlobChunk)).apply(this, arguments));
    }

    createClass(BlobChunk, [{
        key: 'getData',
        value: function getData(buf) {
            var _buf = slicedToArray(buf, 2),
                header = _buf[0],
                data = _buf[1];

            this.readHeader(new DataView(header));
            return data;
        }
    }]);
    return BlobChunk;
}(Chunk);

var Uint8ArrayChunk = function (_Chunk2) {
    inherits(Uint8ArrayChunk, _Chunk2);

    function Uint8ArrayChunk() {
        classCallCheck(this, Uint8ArrayChunk);
        return possibleConstructorReturn(this, (Uint8ArrayChunk.__proto__ || Object.getPrototypeOf(Uint8ArrayChunk)).apply(this, arguments));
    }

    createClass(Uint8ArrayChunk, [{
        key: 'getData',
        value: function getData(buf) {
            this.readHeader(new DataView(buf));
            return new Uint8Array(buf.slice(Common.HEADER_LENGTH));
        }
    }]);
    return Uint8ArrayChunk;
}(Chunk);

function createChunk(buf, context) {
    return __awaiter(this, void 0, void 0, /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
        var length, reader, headerBlob, headerBuf;
        return regeneratorRuntime.wrap(function _callee$(_context) {
            while (1) {
                switch (_context.prev = _context.next) {
                    case 0:
                        if (!(buf instanceof Blob)) {
                            _context.next = 12;
                            break;
                        }

                        length = buf.size;

                        if (!(length < Common.HEADER_LENGTH)) {
                            _context.next = 4;
                            break;
                        }

                        throw new Error('Invalid chunk: Too short');

                    case 4:
                        reader = new FileReader();
                        headerBlob = buf.slice(0, Common.HEADER_LENGTH);
                        _context.next = 8;
                        return new Promise(function (resolve, reject) {
                            reader.onload = function () {
                                resolve(reader.result);
                            };
                            reader.onerror = function () {
                                reject('Unable to read header from Blob');
                            };
                            reader.readAsArrayBuffer(headerBlob);
                        });

                    case 8:
                        headerBuf = _context.sent;
                        return _context.abrupt('return', new BlobChunk([headerBuf, buf.slice(Common.HEADER_LENGTH)], buf.size, context));

                    case 12:
                        if (!(buf instanceof Uint8Array)) {
                            _context.next = 16;
                            break;
                        }

                        return _context.abrupt('return', new Uint8ArrayChunk(buf.buffer, buf.byteLength, context));

                    case 16:
                        if (!(buf instanceof ArrayBuffer)) {
                            _context.next = 20;
                            break;
                        }

                        return _context.abrupt('return', new Uint8ArrayChunk(buf, buf.byteLength, context));

                    case 20:
                        throw TypeError('Cannot create chunk from type ' + (typeof buf === 'undefined' ? 'undefined' : _typeof(buf)));

                    case 21:
                    case 'end':
                        return _context.stop();
                }
            }
        }, _callee, this);
    }));
}

var ChunkCollector = function () {
    function ChunkCollector() {
        classCallCheck(this, ChunkCollector);

        this.lastUpdate = new Date().getTime();
        this.messageLength = null;
        this.chunks = [];
    }

    createClass(ChunkCollector, [{
        key: 'addChunk',
        value: function addChunk(chunk) {
            if (this.hasSerial(chunk.serial)) {
                return;
            }
            this.chunks.push(chunk);
            this.lastUpdate = new Date().getTime();
            if (chunk.isEndOfMessage) {
                this.endArrived = true;
                this.messageLength = chunk.serial + 1;
            }
        }
    }, {
        key: 'hasSerial',
        value: function hasSerial(serial) {
            return this.chunks.find(function (chunk) {
                return chunk.serial == serial;
            }) !== undefined;
        }
    }, {
        key: 'merge',
        value: function merge() {
            if (!this.isComplete) {
                throw new Error('Not all chunks for this message have arrived yet.');
            }
            this.chunks.sort(function (a, b) {
                if (a.serial < b.serial) {
                    return -1;
                } else if (a.serial > b.serial) {
                    return 1;
                }
                return 0;
            });
            return this.mergeChunks();
        }
    }, {
        key: 'isOlderThan',
        value: function isOlderThan(maxAge) {
            var age = new Date().getTime() - this.lastUpdate;
            return age > maxAge;
        }
    }, {
        key: 'isComplete',
        get: function get() {
            return this.endArrived && this.chunks.length == this.messageLength;
        }
    }, {
        key: 'chunkCount',
        get: function get() {
            return this.chunks.length;
        }
    }]);
    return ChunkCollector;
}();

var BlobChunkCollector = function (_ChunkCollector) {
    inherits(BlobChunkCollector, _ChunkCollector);

    function BlobChunkCollector() {
        classCallCheck(this, BlobChunkCollector);
        return possibleConstructorReturn(this, (BlobChunkCollector.__proto__ || Object.getPrototypeOf(BlobChunkCollector)).apply(this, arguments));
    }

    createClass(BlobChunkCollector, [{
        key: 'mergeChunks',
        value: function mergeChunks() {
            var firstSize = this.chunks[0].data.size;
            var contextList = [];
            var dataList = this.chunks.map(function (chunk) {
                if (chunk.data.size > firstSize) {
                    throw new Error('No chunk may be larger than the first chunk of that message.');
                }
                if (chunk.context !== undefined) {
                    contextList.push(chunk.context);
                }
                return chunk.data;
            });
            return {
                message: new Blob(dataList),
                context: contextList
            };
        }
    }]);
    return BlobChunkCollector;
}(ChunkCollector);

var Uint8ArrayChunkCollector = function (_ChunkCollector2) {
    inherits(Uint8ArrayChunkCollector, _ChunkCollector2);

    function Uint8ArrayChunkCollector() {
        classCallCheck(this, Uint8ArrayChunkCollector);
        return possibleConstructorReturn(this, (Uint8ArrayChunkCollector.__proto__ || Object.getPrototypeOf(Uint8ArrayChunkCollector)).apply(this, arguments));
    }

    createClass(Uint8ArrayChunkCollector, [{
        key: 'mergeChunks',
        value: function mergeChunks() {
            var capacity = this.chunks[0].data.byteLength * this.messageLength;
            var buf = new Uint8Array(new ArrayBuffer(capacity));
            var offset = 0;
            var firstSize = this.chunks[0].data.byteLength;
            var contextList = [];
            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = undefined;

            try {
                for (var _iterator = this.chunks[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                    var chunk = _step.value;

                    if (chunk.data.byteLength > firstSize) {
                        throw new Error('No chunk may be larger than the first chunk of that message.');
                    }
                    buf.set(chunk.data, offset);
                    offset += chunk.data.length;
                    if (chunk.context !== undefined) {
                        contextList.push(chunk.context);
                    }
                }
            } catch (err) {
                _didIteratorError = true;
                _iteratorError = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion && _iterator.return) {
                        _iterator.return();
                    }
                } finally {
                    if (_didIteratorError) {
                        throw _iteratorError;
                    }
                }
            }

            return {
                message: buf.slice(0, offset),
                context: contextList
            };
        }
    }]);
    return Uint8ArrayChunkCollector;
}(ChunkCollector);

var Unchunker = function () {
    function Unchunker() {
        classCallCheck(this, Unchunker);

        this.chunks = new Map();
        this.onMessage = null;
    }

    createClass(Unchunker, [{
        key: 'add',
        value: function add(buf, context) {
            return __awaiter(this, void 0, void 0, /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
                var chunk, collector, merged;
                return regeneratorRuntime.wrap(function _callee2$(_context2) {
                    while (1) {
                        switch (_context2.prev = _context2.next) {
                            case 0:
                                _context2.next = 2;
                                return createChunk(buf, context);

                            case 2:
                                chunk = _context2.sent;

                                if (!(this.chunks.has(chunk.id) && this.chunks.get(chunk.id).hasSerial(chunk.serial))) {
                                    _context2.next = 5;
                                    break;
                                }

                                return _context2.abrupt('return');

                            case 5:
                                if (!(chunk.isEndOfMessage && chunk.serial == 0)) {
                                    _context2.next = 9;
                                    break;
                                }

                                this.notifyListener(chunk.data, context === undefined ? [] : [context]);
                                this.chunks.delete(chunk.id);
                                return _context2.abrupt('return');

                            case 9:
                                collector = void 0;

                                if (this.chunks.has(chunk.id)) {
                                    collector = this.chunks.get(chunk.id);
                                } else {
                                    collector = this.createChunkCollector();
                                    this.chunks.set(chunk.id, collector);
                                }
                                collector.addChunk(chunk);
                                if (collector.isComplete) {
                                    merged = collector.merge();

                                    this.notifyListener(merged.message, merged.context);
                                    this.chunks.delete(chunk.id);
                                }

                            case 13:
                            case 'end':
                                return _context2.stop();
                        }
                    }
                }, _callee2, this);
            }));
        }
    }, {
        key: 'notifyListener',
        value: function notifyListener(message, context) {
            if (this.onMessage != null) {
                this.onMessage(message, context);
            }
        }
    }, {
        key: 'gc',
        value: function gc(maxAge) {
            var removedItems = 0;
            var _iteratorNormalCompletion2 = true;
            var _didIteratorError2 = false;
            var _iteratorError2 = undefined;

            try {
                for (var _iterator2 = this.chunks[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                    var entry = _step2.value;

                    var msgId = entry[0];
                    var collector = entry[1];
                    if (collector.isOlderThan(maxAge)) {
                        removedItems += collector.chunkCount;
                        this.chunks.delete(msgId);
                    }
                }
            } catch (err) {
                _didIteratorError2 = true;
                _iteratorError2 = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion2 && _iterator2.return) {
                        _iterator2.return();
                    }
                } finally {
                    if (_didIteratorError2) {
                        throw _iteratorError2;
                    }
                }
            }

            return removedItems;
        }
    }]);
    return Unchunker;
}();

var BlobUnchunker = function (_Unchunker) {
    inherits(BlobUnchunker, _Unchunker);

    function BlobUnchunker() {
        classCallCheck(this, BlobUnchunker);

        var _this5 = possibleConstructorReturn(this, (BlobUnchunker.__proto__ || Object.getPrototypeOf(BlobUnchunker)).apply(this, arguments));

        _this5.onMessage = null;
        return _this5;
    }

    createClass(BlobUnchunker, [{
        key: 'createChunkCollector',
        value: function createChunkCollector() {
            return new BlobChunkCollector();
        }
    }]);
    return BlobUnchunker;
}(Unchunker);

var Uint8ArrayUnchunker = function (_Unchunker2) {
    inherits(Uint8ArrayUnchunker, _Unchunker2);

    function Uint8ArrayUnchunker() {
        classCallCheck(this, Uint8ArrayUnchunker);

        var _this6 = possibleConstructorReturn(this, (Uint8ArrayUnchunker.__proto__ || Object.getPrototypeOf(Uint8ArrayUnchunker)).apply(this, arguments));

        _this6.onMessage = null;
        return _this6;
    }

    createClass(Uint8ArrayUnchunker, [{
        key: 'createChunkCollector',
        value: function createChunkCollector() {
            return new Uint8ArrayChunkCollector();
        }
    }]);
    return Uint8ArrayUnchunker;
}(Unchunker);

exports.Chunker = Chunker;
exports.BlobChunker = BlobChunker;
exports.Uint8ArrayChunker = Uint8ArrayChunker;
exports.Unchunker = Unchunker;
exports.BlobUnchunker = BlobUnchunker;
exports.Uint8ArrayUnchunker = Uint8ArrayUnchunker;

}((this.chunkedDc = this.chunkedDc || {})));
