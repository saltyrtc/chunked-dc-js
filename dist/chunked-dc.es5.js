/**
 * chunked-dc v0.2.3
 * Binary chunking for WebRTC data channels & more.
 * https://github.com/saltyrtc/chunked-dc-js#readme
 *
 * Copyright (C) 2016 Threema GmbH
 *
 * Licensed under the Apache License, Version 2.0, <see LICENSE-APACHE file>
 * or the MIT license <see LICENSE-MIT file>, at your option. This file may not be
 * copied, modified, or distributed except according to those terms.
 */

(function (exports) {
'use strict';

var asyncGenerator = function () {
  function AwaitValue(value) {
    this.value = value;
  }

  function AsyncGenerator(gen) {
    var front, back;

    function send(key, arg) {
      return new Promise(function (resolve, reject) {
        var request = {
          key: key,
          arg: arg,
          resolve: resolve,
          reject: reject,
          next: null
        };

        if (back) {
          back = back.next = request;
        } else {
          front = back = request;
          resume(key, arg);
        }
      });
    }

    function resume(key, arg) {
      try {
        var result = gen[key](arg);
        var value = result.value;

        if (value instanceof AwaitValue) {
          Promise.resolve(value.value).then(function (arg) {
            resume("next", arg);
          }, function (arg) {
            resume("throw", arg);
          });
        } else {
          settle(result.done ? "return" : "normal", result.value);
        }
      } catch (err) {
        settle("throw", err);
      }
    }

    function settle(type, value) {
      switch (type) {
        case "return":
          front.resolve({
            value: value,
            done: true
          });
          break;

        case "throw":
          front.reject(value);
          break;

        default:
          front.resolve({
            value: value,
            done: false
          });
          break;
      }

      front = front.next;

      if (front) {
        resume(front.key, front.arg);
      } else {
        back = null;
      }
    }

    this._invoke = send;

    if (typeof gen.return !== "function") {
      this.return = undefined;
    }
  }

  if (typeof Symbol === "function" && Symbol.asyncIterator) {
    AsyncGenerator.prototype[Symbol.asyncIterator] = function () {
      return this;
    };
  }

  AsyncGenerator.prototype.next = function (arg) {
    return this._invoke("next", arg);
  };

  AsyncGenerator.prototype.throw = function (arg) {
    return this._invoke("throw", arg);
  };

  AsyncGenerator.prototype.return = function (arg) {
    return this._invoke("return", arg);
  };

  return {
    wrap: function (fn) {
      return function () {
        return new AsyncGenerator(fn.apply(this, arguments));
      };
    },
    await: function (value) {
      return new AwaitValue(value);
    }
  };
}();





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
        if (message.byteLength < 1) {
            throw new Error("Array may not be empty");
        }
        if (id < 0 || id >= Math.pow(2, 32)) {
            throw new Error("Message id must be between 0 and 2**32-1");
        }
        this.id = id;
        this.message = message;
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

var Chunk = function () {
    function Chunk(buf, context) {
        classCallCheck(this, Chunk);

        if (buf.byteLength < Common.HEADER_LENGTH) {
            throw new Error('Invalid chunk: Too short');
        }
        var reader = new DataView(buf);
        var options = reader.getUint8(0);
        this._endOfMessage = (options & 0x01) == 1;
        this._id = reader.getUint32(1);
        this._serial = reader.getUint32(5);
        this._data = new Uint8Array(buf.slice(Common.HEADER_LENGTH));
        this._context = context;
    }

    createClass(Chunk, [{
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

var ChunkCollector = function () {
    function ChunkCollector() {
        classCallCheck(this, ChunkCollector);

        this.messageLength = null;
        this.chunks = [];
        this.lastUpdate = new Date().getTime();
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

var Unchunker = function () {
    function Unchunker() {
        classCallCheck(this, Unchunker);

        this.chunks = new Map();
        this.onMessage = null;
    }

    createClass(Unchunker, [{
        key: 'add',
        value: function add(buf, context) {
            var chunk = new Chunk(buf, context);
            if (this.chunks.has(chunk.id) && this.chunks.get(chunk.id).hasSerial(chunk.serial)) {
                return;
            }
            if (chunk.isEndOfMessage && chunk.serial == 0) {
                this.notifyListener(chunk.data, context === undefined ? [] : [context]);
                this.chunks.delete(chunk.id);
                return;
            }
            var collector = void 0;
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

exports.Chunker = Chunker;
exports.Unchunker = Unchunker;

}((this.chunkedDc = this.chunkedDc || {})));
