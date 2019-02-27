/**
 * chunked-dc v2.0.1
 * Binary chunking for WebRTC data channels & more.
 * https://github.com/saltyrtc/chunked-dc-js#readme
 *
 * Copyright (C) 2016-2019 Threema GmbH
 *
 * Licensed under the Apache License, Version 2.0, <see LICENSE-APACHE file>
 * or the MIT license <see LICENSE-MIT file>, at your option. This file may not be
 * copied, modified, or distributed except according to those terms.
 */

var chunkedDc = (function (exports) {
    'use strict';

    var RELIABLE_ORDERED_HEADER_LENGTH = 1;
    var UNRELIABLE_UNORDERED_HEADER_LENGTH = 9;
    var MODE_BITMASK = 6;

    (function (Mode) {
      Mode[Mode["ReliableOrdered"] = 6] = "ReliableOrdered";
      Mode[Mode["UnreliableUnordered"] = 0] = "UnreliableUnordered";
    })(exports.Mode || (exports.Mode = {}));

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

    function _inherits(subClass, superClass) {
      if (typeof superClass !== "function" && superClass !== null) {
        throw new TypeError("Super expression must either be null or a function");
      }

      subClass.prototype = Object.create(superClass && superClass.prototype, {
        constructor: {
          value: subClass,
          writable: true,
          configurable: true
        }
      });
      if (superClass) _setPrototypeOf(subClass, superClass);
    }

    function _getPrototypeOf(o) {
      _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) {
        return o.__proto__ || Object.getPrototypeOf(o);
      };
      return _getPrototypeOf(o);
    }

    function _setPrototypeOf(o, p) {
      _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) {
        o.__proto__ = p;
        return o;
      };

      return _setPrototypeOf(o, p);
    }

    function _assertThisInitialized(self) {
      if (self === void 0) {
        throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
      }

      return self;
    }

    function _possibleConstructorReturn(self, call) {
      if (call && (typeof call === "object" || typeof call === "function")) {
        return call;
      }

      return _assertThisInitialized(self);
    }

    function _slicedToArray(arr, i) {
      return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest();
    }

    function _arrayWithHoles(arr) {
      if (Array.isArray(arr)) return arr;
    }

    function _iterableToArrayLimit(arr, i) {
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
          if (!_n && _i["return"] != null) _i["return"]();
        } finally {
          if (_d) throw _e;
        }
      }

      return _arr;
    }

    function _nonIterableRest() {
      throw new TypeError("Invalid attempt to destructure non-iterable instance");
    }

    var AbstractChunker =
    /*#__PURE__*/
    function () {
      function AbstractChunker(mode, headerLength, id, message, chunkLength) {
        var buffer = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : null;

        _classCallCheck(this, AbstractChunker);

        this.offset = 0;
        this.serial = 0;
        var minChunkSize = headerLength + 1;

        if (chunkLength < minChunkSize) {
          throw new Error("Chunk size must be at least ".concat(minChunkSize));
        }

        if (buffer !== null && buffer.byteLength < chunkLength) {
          throw new Error('Buffer too small for chunks');
        }

        if (message.byteLength < 1) {
          throw new Error('Message may not be empty');
        }

        if (id != null && (id < 0 || id >= Math.pow(2, 32))) {
          throw new Error('Message id must be between 0 and 2**32-1');
        }

        this.mode = mode;
        this.id = id;
        this.message = message;
        this.headerLength = headerLength;
        this.payloadLength = chunkLength - headerLength;
        this.buffer = buffer;
      }

      _createClass(AbstractChunker, [{
        key: "next",
        value: function next() {
          if (!this.hasNext) {
            return {
              done: true,
              value: null
            };
          }

          var remaining = this.message.byteLength - this.offset;
          var payloadLength = remaining < this.payloadLength ? remaining : this.payloadLength;
          var chunkLength = this.headerLength + payloadLength;
          var endOffset = this.offset + payloadLength;
          var chunkBuffer;

          if (this.buffer !== null) {
            chunkBuffer = this.buffer;
          } else {
            chunkBuffer = new ArrayBuffer(chunkLength);
          }

          var chunkView = new DataView(chunkBuffer);
          var options = this.mode;

          if (endOffset === this.message.byteLength) {
            options |= 1;
          }

          chunkView.setUint8(0, options);

          switch (this.mode) {
            case exports.Mode.ReliableOrdered:
              break;

            case exports.Mode.UnreliableUnordered:
              chunkView.setUint32(1, this.id);
              chunkView.setUint32(5, this.serial++);
              break;
          }

          var payloadSlice = this.message.subarray(this.offset, endOffset);
          var chunkArray = new Uint8Array(chunkBuffer, 0, chunkLength);
          chunkArray.set(payloadSlice, this.headerLength);
          this.offset = endOffset;
          return {
            done: false,
            value: chunkArray
          };
        }
      }, {
        key: Symbol.iterator,
        value: function value() {
          return this;
        }
      }, {
        key: "hasNext",
        get: function get() {
          return this.offset < this.message.byteLength;
        }
      }]);

      return AbstractChunker;
    }();

    var ReliableOrderedChunker =
    /*#__PURE__*/
    function (_AbstractChunker) {
      _inherits(ReliableOrderedChunker, _AbstractChunker);

      function ReliableOrderedChunker(message, chunkLength, buffer) {
        _classCallCheck(this, ReliableOrderedChunker);

        return _possibleConstructorReturn(this, _getPrototypeOf(ReliableOrderedChunker).call(this, exports.Mode.ReliableOrdered, RELIABLE_ORDERED_HEADER_LENGTH, null, message, chunkLength, buffer));
      }

      return ReliableOrderedChunker;
    }(AbstractChunker);
    var UnreliableUnorderedChunker =
    /*#__PURE__*/
    function (_AbstractChunker2) {
      _inherits(UnreliableUnorderedChunker, _AbstractChunker2);

      function UnreliableUnorderedChunker(id, message, chunkLength, buffer) {
        _classCallCheck(this, UnreliableUnorderedChunker);

        return _possibleConstructorReturn(this, _getPrototypeOf(UnreliableUnorderedChunker).call(this, exports.Mode.UnreliableUnordered, UNRELIABLE_UNORDERED_HEADER_LENGTH, id, message, chunkLength, buffer));
      }

      return UnreliableUnorderedChunker;
    }(AbstractChunker);

    var Chunk = function Chunk(chunkArray, expectedMode, headerLength) {
      _classCallCheck(this, Chunk);

      if (chunkArray.byteLength < headerLength) {
        throw new Error('Invalid chunk: Too short');
      }

      var chunkView = new DataView(chunkArray.buffer, chunkArray.byteOffset, chunkArray.byteLength);
      var options = chunkView.getUint8(0);
      var actualMode = options & MODE_BITMASK;

      if (actualMode !== expectedMode) {
        throw new Error("Invalid chunk: Unexpected mode ".concat(actualMode));
      }

      switch (expectedMode) {
        case exports.Mode.ReliableOrdered:
          break;

        case exports.Mode.UnreliableUnordered:
          this.id = chunkView.getUint32(1);
          this.serial = chunkView.getUint32(5);
          break;
      }

      this.endOfMessage = (options & 1) === 1;
      this.payload = chunkArray.subarray(headerLength);
    };

    var ContiguousBufferReassembler =
    /*#__PURE__*/
    function () {
      function ContiguousBufferReassembler() {
        var buffer = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;

        _classCallCheck(this, ContiguousBufferReassembler);

        this.complete = false;
        this.buffer = buffer;

        if (this.buffer !== null) {
          this.array = new Uint8Array(this.buffer);
          this.offset = 0;
          this.remaining = this.buffer.byteLength;
        } else {
          this.array = null;
          this.offset = 0;
          this.remaining = 0;
        }
      }

      _createClass(ContiguousBufferReassembler, [{
        key: "add",
        value: function add(chunk) {
          if (this.complete) {
            throw new Error('Message already complete');
          }

          var chunkLength = chunk.payload.byteLength;
          this.maybeResize(chunkLength);
          this.complete = chunk.endOfMessage;
          this.array.set(chunk.payload, this.offset);
          this.offset += chunkLength;
          this.remaining -= chunkLength;
        }
      }, {
        key: "addBatched",
        value: function addBatched(chunks, totalByteLength) {
          this.maybeResize(totalByteLength);
          var chunk;
          var _iteratorNormalCompletion = true;
          var _didIteratorError = false;
          var _iteratorError = undefined;

          try {
            for (var _iterator = chunks[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
              chunk = _step.value;

              if (this.complete) {
                throw new Error('Message already complete');
              }

              this.complete = chunk.endOfMessage;
              this.array.set(chunk.payload, this.offset);
              this.offset += chunk.payload.byteLength;
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

          this.remaining -= totalByteLength;
          return chunk;
        }
      }, {
        key: "maybeResize",
        value: function maybeResize(requiredLength) {
          if (this.buffer === null) {
            this.buffer = new ArrayBuffer(requiredLength);
            this.array = new Uint8Array(this.buffer);
            return;
          }

          if (this.remaining < requiredLength) {
            var previousArray = this.array;
            var length = Math.max(previousArray.byteLength * 2, previousArray.byteLength + requiredLength);
            this.buffer = new ArrayBuffer(length);
            this.array = new Uint8Array(this.buffer);
            this.array.set(previousArray);
            this.remaining = length - this.offset;
          }
        }
      }, {
        key: "getMessage",
        value: function getMessage() {
          if (!this.complete) {
            throw new Error('Message not complete');
          }

          var message = this.array.subarray(0, this.offset);
          this.complete = false;
          this.offset = 0;
          this.remaining = this.buffer.byteLength;
          return message;
        }
      }, {
        key: "empty",
        get: function get() {
          return this.offset === 0;
        }
      }]);

      return ContiguousBufferReassembler;
    }();

    var UnreliableUnorderedReassembler =
    /*#__PURE__*/
    function () {
      function UnreliableUnorderedReassembler() {
        _classCallCheck(this, UnreliableUnorderedReassembler);

        this.contiguousChunks = new ContiguousBufferReassembler();
        this.queuedChunks = null;
        this.queuedChunksTotalByteLength = 0;
        this._chunkCount = 0;
        this.nextOrderedSerial = 0;
        this.lastUpdate = new Date().getTime();
        this.requiredChunkCount = null;
      }

      _createClass(UnreliableUnorderedReassembler, [{
        key: "add",
        value: function add(chunk) {
          if (this.complete) {
            throw new Error('Message already complete');
          }

          if (this.queuedChunks === null && chunk.serial === this._chunkCount) {
            this.contiguousChunks.add(chunk);
            this.nextOrderedSerial = chunk.serial + 1;
          } else {
            var ready = this.queueUnorderedChunk(chunk);

            if (ready) {
              this.moveQueuedChunks();
            }
          }

          if (chunk.endOfMessage) {
            this.requiredChunkCount = chunk.serial + 1;
          }

          ++this._chunkCount;
          this.lastUpdate = new Date().getTime();
        }
      }, {
        key: "queueUnorderedChunk",
        value: function queueUnorderedChunk(chunk) {
          this.queuedChunksTotalByteLength += chunk.payload.byteLength;

          if (this.queuedChunks === null) {
            this.queuedChunks = [chunk];
            return false;
          }

          this.queuedChunks.push(chunk);
          this.queuedChunks.sort(function (a, b) {
            if (a.serial < b.serial) {
              return -1;
            }

            if (a.serial > b.serial) {
              return 1;
            }

            return 0;
          });
          var iterator = this.queuedChunks.values();
          var previousChunk = iterator.next().value;

          if (previousChunk.serial !== this.nextOrderedSerial) {
            return false;
          }

          var _iteratorNormalCompletion2 = true;
          var _didIteratorError2 = false;
          var _iteratorError2 = undefined;

          try {
            for (var _iterator2 = iterator[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
              var currentChunk = _step2.value;

              if (previousChunk.serial + 1 !== currentChunk.serial) {
                return false;
              }

              previousChunk = currentChunk;
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

          return true;
        }
      }, {
        key: "moveQueuedChunks",
        value: function moveQueuedChunks() {
          var chunk = this.contiguousChunks.addBatched(this.queuedChunks, this.queuedChunksTotalByteLength);
          this.nextOrderedSerial = chunk.serial + 1;
          this.queuedChunks = null;
        }
      }, {
        key: "getMessage",
        value: function getMessage() {
          if (!this.complete) {
            throw new Error('Message not complete');
          }

          return this.contiguousChunks.getMessage();
        }
      }, {
        key: "isOlderThan",
        value: function isOlderThan(maxAge) {
          var age = new Date().getTime() - this.lastUpdate;
          return age > maxAge;
        }
      }, {
        key: "chunkCount",
        get: function get() {
          return this._chunkCount;
        }
      }, {
        key: "complete",
        get: function get() {
          return this.requiredChunkCount !== null && this._chunkCount === this.requiredChunkCount;
        }
      }]);

      return UnreliableUnorderedReassembler;
    }();

    var AbstractUnchunker =
    /*#__PURE__*/
    function () {
      function AbstractUnchunker() {
        _classCallCheck(this, AbstractUnchunker);

        this.onMessage = null;
      }

      _createClass(AbstractUnchunker, [{
        key: "notifyListener",
        value: function notifyListener(message) {
          if (this.onMessage != null) {
            this.onMessage(message);
          }
        }
      }]);

      return AbstractUnchunker;
    }();

    var ReliableOrderedUnchunker =
    /*#__PURE__*/
    function (_AbstractUnchunker) {
      _inherits(ReliableOrderedUnchunker, _AbstractUnchunker);

      function ReliableOrderedUnchunker(buffer) {
        var _this;

        _classCallCheck(this, ReliableOrderedUnchunker);

        _this = _possibleConstructorReturn(this, _getPrototypeOf(ReliableOrderedUnchunker).call(this));
        _this.reassembler = new ContiguousBufferReassembler(buffer);
        return _this;
      }

      _createClass(ReliableOrderedUnchunker, [{
        key: "add",
        value: function add(chunkArray) {
          var chunk = new Chunk(chunkArray, exports.Mode.ReliableOrdered, RELIABLE_ORDERED_HEADER_LENGTH);

          if (this.reassembler.empty && chunk.endOfMessage) {
            this.notifyListener(chunk.payload);
            return;
          }

          this.reassembler.add(chunk);

          if (chunk.endOfMessage) {
            this.notifyListener(this.reassembler.getMessage());
          }
        }
      }]);

      return ReliableOrderedUnchunker;
    }(AbstractUnchunker);
    var UnreliableUnorderedUnchunker =
    /*#__PURE__*/
    function (_AbstractUnchunker2) {
      _inherits(UnreliableUnorderedUnchunker, _AbstractUnchunker2);

      function UnreliableUnorderedUnchunker() {
        var _this2;

        _classCallCheck(this, UnreliableUnorderedUnchunker);

        _this2 = _possibleConstructorReturn(this, _getPrototypeOf(UnreliableUnorderedUnchunker).apply(this, arguments));
        _this2.reassemblers = new Map();
        return _this2;
      }

      _createClass(UnreliableUnorderedUnchunker, [{
        key: "add",
        value: function add(chunkArray) {
          var chunk = new Chunk(chunkArray, exports.Mode.UnreliableUnordered, UNRELIABLE_UNORDERED_HEADER_LENGTH);

          if (chunk.endOfMessage && chunk.serial === 0) {
            this.notifyListener(chunk.payload);
            return;
          }

          var reassembler = this.reassemblers.get(chunk.id);

          if (reassembler === undefined) {
            reassembler = new UnreliableUnorderedReassembler();
            this.reassemblers.set(chunk.id, reassembler);
          }

          reassembler.add(chunk);

          if (reassembler.complete) {
            this.notifyListener(reassembler.getMessage());
            this.reassemblers.delete(chunk.id);
          }
        }
      }, {
        key: "gc",
        value: function gc(maxAge) {
          var removed = 0;
          var _iteratorNormalCompletion3 = true;
          var _didIteratorError3 = false;
          var _iteratorError3 = undefined;

          try {
            for (var _iterator3 = this.reassemblers[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
              var _step3$value = _slicedToArray(_step3.value, 2),
                  id = _step3$value[0],
                  reassembler = _step3$value[1];

              if (reassembler.isOlderThan(maxAge)) {
                removed += reassembler.chunkCount;
                this.reassemblers.delete(id);
              }
            }
          } catch (err) {
            _didIteratorError3 = true;
            _iteratorError3 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion3 && _iterator3.return != null) {
                _iterator3.return();
              }
            } finally {
              if (_didIteratorError3) {
                throw _iteratorError3;
              }
            }
          }

          return removed;
        }
      }]);

      return UnreliableUnorderedUnchunker;
    }(AbstractUnchunker);

    exports.UNRELIABLE_UNORDERED_HEADER_LENGTH = UNRELIABLE_UNORDERED_HEADER_LENGTH;
    exports.RELIABLE_ORDERED_HEADER_LENGTH = RELIABLE_ORDERED_HEADER_LENGTH;
    exports.ReliableOrderedChunker = ReliableOrderedChunker;
    exports.UnreliableUnorderedChunker = UnreliableUnorderedChunker;
    exports.ReliableOrderedUnchunker = ReliableOrderedUnchunker;
    exports.UnreliableUnorderedUnchunker = UnreliableUnorderedUnchunker;

    return exports;

}({}));
//# sourceMappingURL=chunked-dc.es5.js.map
