
/**
 * Module dependencies.
 */

var util = require('util');
var assert = require('assert');
var debug = require('debug')('wave:reader');
var Transform = require('stream').Transform;
var Parser = require('stream-parser');
var inherits = util.inherits;
var f = util.format;

// for node v0.8.x support, remove after v0.12.x
if (!Transform) Transform = require('readable-stream/transform');

/**
 * Module exports.
 */

module.exports = Reader;

/**
 * The `Reader` class accepts a WAV audio file written to it and outputs the raw
 * audio data with the WAV header stripped (most of the time, PCM audio data will
 * be output, depending on the `audioFormat` property).
 *
 * A `"format"` event gets emitted after the WAV header has been parsed.
 *
 * @param {Object} opts optional options object
 * @api public
 */

function Reader (opts) {
  if (!(this instanceof Reader)) {
    return new Reader(opts);
  }
  Transform.call(this, opts);

  this._bytes(4, this._onRiffID);
}
inherits(Reader, Transform);

/**
 * Mixin `Parser`.
 */

Parser(Reader.prototype);

// the beginning of the WAV file
Reader.prototype._onRiffID = function (chunk) {
  debug('onRiffID:', chunk);
  var id = this.riffId = chunk.toString('ascii');
  if ('RIFF' === id) {
    debug('detected little-endian WAVE file');
    this.endianness = 'LE';
    this._bytes(4, this._onChunkSize);
  } else if ('RIFX' === id) {
    debug('detected big-endian WAVE file');
    this.endianness = 'BE';
    this._bytes(4, this._onChunkSize);
  } else {
    this.emit('error', new Error(f('bad "chunk id": expected "RIFF" or "RIFX", got %j', id)));
  }
};

// size of the WAV
Reader.prototype._onChunkSize = function (chunk) {
  debug('onChunkSize:', chunk);
  this.chunkSize = chunk['readUInt32' + this.endianness](0);
  this._bytes(4, this._onFormat);
};

// the RIFF "format", should always be "WAVE"
Reader.prototype._onFormat = function (chunk) {
  debug('onFormat:', chunk);
  this.waveId = chunk.toString('ascii');
  if ('WAVE' === this.waveId) {
    this._bytes(4, this._onSubchunk1ID);
  } else {
    this.emit('error', new Error(f('bad "format": expected "WAVE", got %j', this.waveId)));
  }
};

// size of the "subchunk1" (the header)
Reader.prototype._onSubchunk1ID = function (chunk) {
  debug('onSubchunk1ID:', chunk);
  var subchunk1ID = chunk.toString('ascii');
  this.chunkId = subchunk1ID;
  if ('fmt ' === subchunk1ID) {
    this._bytes(4, this._onSubchunk1Size);
  } else {
    this.emit('error', new Error(f('bad "fmt id": expected "fmt ", got %j', subchunk1ID)));
  }
};

Reader.prototype._onSubchunk1Size = function (chunk) {
  debug('onSubchunk1Size:', chunk);
  this.subchunk1Size = chunk['readUInt32' + this.endianness](0);
  // TODO: assert should be 16 for PCM
  this._bytes(this.subchunk1Size, this._onSubchunk1);
};

Reader.prototype._onSubchunk1 = function (chunk) {
  debug('onSubchunk1:', chunk);
  // TODO: support formats other than PCM?
  this.audioFormat = chunk['readUInt16' + this.endianness](0);
  this.channels = chunk['readUInt16' + this.endianness](2);
  this.sampleRate = chunk['readUInt32' + this.endianness](4);
  this.byteRate = chunk['readUInt32' + this.endianness](8); // useless...
  this.blockAlign = chunk['readUInt16' + this.endianness](12); // useless...
  this.bitDepth = chunk['readUInt16' + this.endianness](14);
  this.signed = this.bitDepth != 8;

  this.emit('format', {
    audioFormat: this.audioFormat,
    endianness: this.endianness,
    channels: this.channels,
    sampleRate: this.sampleRate,
    byteRate: this.byteRate,
    blockAlign: this.blockAlign,
    bitDepth: this.bitDepth,
    signed: this.signed
  });

  this._bytes(4, this._onSubchunk2ID);
};

Reader.prototype._onSubchunk2ID = function (chunk) {
  debug('onSubchunk2ID:', chunk);
  var subchunk2ID = chunk.toString('ascii');
  if ('data' === subchunk2ID) {
    this._bytes(4, this._onSubchunk2Size);
  } else {
    this.emit('error', new Error(f('bad "data" chunk: expected "data", got %j', subchunk2ID)));
  }
};

// size of the remaining data in this WAV file
Reader.prototype._onSubchunk2Size = function (chunk) {
  debug('onSubchunk2Size:', chunk);
  this.subchunk2Size = chunk['readUInt32' + this.endianness](0);

  // even though the WAV file reports a remaining byte length, in practice it
  // can't really be trusted since in streaming situations where the WAV file is
  // being generated on-the-fly, the number of remaining bytes would be impossible
  // to know beforehand. For this reason, some encoders write `0` for the byte
  // length here... In any case, we are just gonna pass through the rest of the
  // stream until EOF.
  this._passthrough(Infinity, this._onEnd);
};
