/**
 * chunked-dc v1.1.0
 * Binary chunking for WebRTC data channels & more.
 * https://github.com/saltyrtc/chunked-dc-js#readme
 *
 * Copyright (C) 2016-2018 Threema GmbH
 *
 * Licensed under the Apache License, Version 2.0, <see LICENSE-APACHE file>
 * or the MIT license <see LICENSE-MIT file>, at your option. This file may not be
 * copied, modified, or distributed except according to those terms.
 */

var chunkedDc = (function (exports) {
  'use strict';

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  function _defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  function _createClass(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties(Constructor, staticProps);
    return Constructor;
  }

  var Common = function Common() {
    _classCallCheck(this, Common);
  };

  Common.HEADER_LENGTH = 9;

  var Chunker =
  /*#__PURE__*/
  function () {
    function Chunker(id, message, chunkSize) {
      _classCallCheck(this, Chunker);

      this.chunkId = 0;

      if (chunkSize < Common.HEADER_LENGTH + 1) {
        throw new Error('Chunk size must be at least ' + (Common.HEADER_LENGTH + 1));
      }

      if (message.byteLength < 1) {
        throw new Error('Array may not be empty');
      }

      if (id < 0 || id >= Math.pow(2, 32)) {
        throw new Error('Message id must be between 0 and 2**32-1');
      }

      this.id = id;
      this.message = message;
      this.chunkDataSize = chunkSize - Common.HEADER_LENGTH;
    }

    _createClass(Chunker, [{
      key: "next",
      value: function next() {
        if (!this.hasNext) {
          return {
            done: true,
            value: null
          };
        }

        var currentIndex = this.chunkId * this.chunkDataSize;
        var remaining = this.message.byteLength - currentIndex;
        var chunkBytes = remaining < this.chunkDataSize ? remaining : this.chunkDataSize;
        var chunk = new DataView(new ArrayBuffer(chunkBytes + Common.HEADER_LENGTH));
        var options = remaining > chunkBytes ? 0 : 1;
        var id = this.id;
        var serial = this.nextSerial();
        chunk.setUint8(0, options);
        chunk.setUint32(1, id);
        chunk.setUint32(5, serial);

        for (var i = 0; i < chunkBytes; i++) {
          var offset = Common.HEADER_LENGTH + i;
          chunk.setUint8(offset, this.message[currentIndex + i]);
        }

        return {
          done: false,
          value: new Uint8Array(chunk.buffer)
        };
      }
    }, {
      key: "nextSerial",
      value: function nextSerial() {
        return this.chunkId++;
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
        var remaining = this.message.byteLength - currentIndex;
        return remaining >= 1;
      }
    }]);

    return Chunker;
  }();

  var Chunk =
  /*#__PURE__*/
  function () {
    function Chunk(buf, context) {
      _classCallCheck(this, Chunk);

      if (buf.byteLength < Common.HEADER_LENGTH) {
        throw new Error('Invalid chunk: Too short');
      }

      var reader = new DataView(buf);
      var options = reader.getUint8(0);
      this._endOfMessage = (options & 0x01) === 1;
      this._id = reader.getUint32(1);
      this._serial = reader.getUint32(5);
      this._data = new Uint8Array(buf.slice(Common.HEADER_LENGTH));
      this._context = context;
    }

    _createClass(Chunk, [{
      key: "isEndOfMessage",
      get: function get() {
        return this._endOfMessage;
      }
    }, {
      key: "id",
      get: function get() {
        return this._id;
      }
    }, {
      key: "serial",
      get: function get() {
        return this._serial;
      }
    }, {
      key: "data",
      get: function get() {
        return this._data;
      }
    }, {
      key: "context",
      get: function get() {
        return this._context;
      }
    }]);

    return Chunk;
  }();

  var ChunkCollector =
  /*#__PURE__*/
  function () {
    function ChunkCollector() {
      _classCallCheck(this, ChunkCollector);

      this.messageLength = null;
      this.chunks = [];
      this.lastUpdate = new Date().getTime();
    }

    _createClass(ChunkCollector, [{
      key: "addChunk",
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
      key: "hasSerial",
      value: function hasSerial(serial) {
        return this.chunks.find(function (chunk) {
          return chunk.serial === serial;
        }) !== undefined;
      }
    }, {
      key: "merge",
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
            if (!_iteratorNormalCompletion && _iterator.return != null) {
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
    }, {
      key: "isOlderThan",
      value: function isOlderThan(maxAge) {
        var age = new Date().getTime() - this.lastUpdate;
        return age > maxAge;
      }
    }, {
      key: "isComplete",
      get: function get() {
        return this.endArrived && this.chunks.length === this.messageLength;
      }
    }, {
      key: "chunkCount",
      get: function get() {
        return this.chunks.length;
      }
    }]);

    return ChunkCollector;
  }();

  var Unchunker =
  /*#__PURE__*/
  function () {
    function Unchunker() {
      _classCallCheck(this, Unchunker);

      this.chunks = new Map();
      this.onMessage = null;
    }

    _createClass(Unchunker, [{
      key: "add",
      value: function add(buf, context) {
        var chunk = new Chunk(buf, context);

        if (this.chunks.has(chunk.id) && this.chunks.get(chunk.id).hasSerial(chunk.serial)) {
          return;
        }

        if (chunk.isEndOfMessage && chunk.serial === 0) {
          this.notifyListener(chunk.data, context === undefined ? [] : [context]);
          this.chunks.delete(chunk.id);
          return;
        }

        var collector;

        if (this.chunks.has(chunk.id)) {
          collector = this.chunks.get(chunk.id);
        } else {
          collector = new ChunkCollector();
          this.chunks.set(chunk.id, collector);
        }

        collector.addChunk(chunk);

        if (collector.isComplete) {
          var merged = collector.merge();
          this.notifyListener(merged.message, merged.context);
          this.chunks.delete(chunk.id);
        }
      }
    }, {
      key: "notifyListener",
      value: function notifyListener(message, context) {
        if (this.onMessage != null) {
          this.onMessage(message, context);
        }
      }
    }, {
      key: "gc",
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
            if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
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

  var HEADER_LENGTH = Common.HEADER_LENGTH;

  exports.HEADER_LENGTH = HEADER_LENGTH;
  exports.Chunker = Chunker;
  exports.Unchunker = Unchunker;

  return exports;

}({}));
//# sourceMappingURL=chunked-dc.es5.js.map
