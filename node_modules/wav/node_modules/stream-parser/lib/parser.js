
/**
 * Module dependencies.
 */

var assert = require('assert');
var debug = require('debug')('stream-parser');

/**
 * Module exports.
 */

module.exports = Parser;

/**
 * The `Parser` stream mixin works with either `Writable` or `Transform` stream
 * instances/subclasses. Provides a convenient generic "parsing" API:
 *
 *   _bytes(n, cb) - buffers "n" bytes and then calls "cb" with the "chunk"
 *
 * If you extend a `Transform` stream, then the `_passthrough()` function is also
 * added:
 *
 *   _passthrough(n, cb) - passes through "n" bytes untouched and then calls "cb"
 *
 * @param {Stream} stream Transform or Writable stream instance to extend
 * @api public
 */

function Parser (stream) {
  var isTransform = stream && 'function' == typeof stream._transform;
  var isWritable = stream && 'function' == typeof stream._write;

  if (!isTransform && !isWritable) throw new Error('must pass a Writable or Transform stream in');
  debug('extending Parser into stream');

  // both Transform streams and Writable streams get `_bytes()`
  stream._bytes = _bytes;

  // only Transform streams get the `_passthrough()` function
  if (isTransform) stream._passthrough = _passthrough;

  // take control of the streams2 callback functions for this stream
  if (isTransform) {
    stream._transform = transform;
  } else {
    stream._write = write;
  }
}

function init (stream) {
  debug('initializing parser stream');

  // number of bytes left to parser for the next "chunk"
  stream._parserBytesLeft = 0;

  // array of Buffer instances that make up the next "chunk"
  stream._parserBuffers = [];

  // number of bytes parsed so far for the next "chunk"
  stream._parserBuffered = 0;

  // flag the keeps track of if we're buffering or passing-through
  stream._parserBuffering = false;

  // the callback for the next "chunk"
  stream._parserCallback = null;

  // XXX: backwards compat with the old Transform API... remove at some point..
  if ('function' == typeof stream.push) {
    stream._parserOutput = stream.push.bind(stream);
  }

  stream._parserInit = true;
}

/**
 * Buffers `n` bytes and then invokes `fn` once that amount has been collected.
 *
 * @param {Number} n the number of bytes to buffer
 * @param {Function} fn callback function to invoke when `n` bytes are buffered
 * @api public
 */

function _bytes (n, fn) {
  assert(!this._parserCallback, 'there is already a "callback" set!');
  assert(isFinite(n) && n > 0, 'can only buffer a finite number of bytes > 0, got "' + n + '"');
  if (!this._parserInit) init(this);
  debug('buffering %o bytes', n);
  this._parserBytesLeft = n;
  this._parserCallback = fn;
  this._parserBuffering = true;
}

/**
 * Passes through `n` bytes to the readable side of this stream untouched,
 * then invokes `fn` once that amount has been passed through.
 *
 * @param {Number} n the number of bytes to pass through
 * @param {Function} fn callback function to invoke when `n` bytes have passed through
 * @api public
 */

function _passthrough (n, fn) {
  assert(!this._parserCallback, 'There is already a "callback" set!');
  assert(n > 0, 'can only pass through > 0 bytes, got "' + n + '"');
  if (!this._parserInit) init(this);
  debug('passing through %o bytes', n);
  this._parserBytesLeft = n;
  this._parserCallback = fn;
  this._parserBuffering = false;
}

/**
 * The `_write()` callback function implementation.
 *
 * @api private
 */

function write (chunk, encoding, fn) {
  if (!this._parserInit) init(this);
  debug('write(%o bytes)', chunk.length);

  // XXX: old Writable stream API compat... remove at some point...
  if ('function' == typeof encoding) fn = encoding;

  data(this, chunk, null, fn);
}

/**
 * The `_transform()` callback function implementation.
 *
 * @api private
 */


function transform (chunk, output, fn) {
  if (!this._parserInit) init(this);
  debug('transform(%o bytes)', chunk.length);

  // XXX: old Transform stream API compat... remove at some point...
  if ('function' != typeof output) {
    output = this._parserOutput;
  }

  data(this, chunk, output, fn);
}

/**
 * The internal buffering/passthrough logic...
 *
 * This `_data` function get's "trampolined" to prevent stack overflows for tight
 * loops. This technique requires us to return a "thunk" function for any
 * synchronous action. Async stuff breaks the trampoline, but that's ok since it's
 * working with a new stack at that point anyway.
 *
 * @api private
 */

function _data (stream, chunk, output, fn) {
  assert(stream._parserBytesLeft > 0, 'got data but not currently parsing anything');

  if (chunk.length <= stream._parserBytesLeft) {
    // small buffer fits within the "_parserBytesLeft" window
    return function () {
      return process(stream, chunk, output, fn);
    };
  } else {
    // large buffer needs to be sliced on "_parserBytesLeft" and processed
    return function () {
      var b = chunk.slice(0, stream._parserBytesLeft);
      return process(stream, b, output, function (err) {
        if (err) return fn(err);
        if (chunk.length > b.length) {
          return function () {
            return _data(stream, chunk.slice(b.length), output, fn);
          };
        }
      });
    };
  }
}

/**
 * The internal `process` function gets called by the `data` function when
 * something "interesting" happens. This function takes care of buffering the
 * bytes when buffering, passing through the bytes when doing that, and invoking
 * the user callback when the number of bytes has been reached.
 *
 * @api private
 */

function process (stream, chunk, output, fn) {
  stream._parserBytesLeft -= chunk.length;
  debug('%o bytes left for stream piece', stream._parserBytesLeft);

  if (stream._parserBuffering) {
    // buffer
    stream._parserBuffers.push(chunk);
    stream._parserBuffered += chunk.length;
  } else {
    // passthrough
    output(chunk);
  }

  if (0 === stream._parserBytesLeft) {
    // done with stream "piece", invoke the callback
    var cb = stream._parserCallback;
    if (cb && stream._parserBuffering && stream._parserBuffers.length > 1) {
      chunk = Buffer.concat(stream._parserBuffers, stream._parserBuffered);
    }
    if (!stream._parserBuffering) {
      chunk = null;
    }
    stream._parserCallback = null;
    stream._parserBuffered = 0;
    stream._parserBuffering = true;
    stream._parserBuffers.splice(0); // empty

    if (cb) {
      var args = [];
      if (chunk) {
        // buffered
        args.push(chunk);
      } else {
        // passthrough
      }
      if (output) {
        // on a Transform stream, has "output" function
        args.push(output);
      }
      var async = cb.length > args.length;
      if (async) {
        args.push(trampoline(fn));
      }
      // invoke cb
      var rtn = cb.apply(stream, args);
      if (!async || fn === rtn) return fn;
    }
  } else {
    // need more bytes
    return fn;
  }
}

var data = trampoline(_data);

/**
 * Generic thunk-based "trampoline" helper function.
 *
 * @param {Function} input function
 * @return {Function} "trampolined" function
 * @api private
 */

function trampoline (fn) {
  return function () {
    var result = fn.apply(this, arguments);

    while ('function' == typeof result) {
      result = result();
    }

    return result;
  };
}
