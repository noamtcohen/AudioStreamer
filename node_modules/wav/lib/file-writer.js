
/**
 * Module dependencies.
 */

var fs = require('fs');
var Writer = require('./writer');
var inherits = require('util').inherits;

/**
 * Module exports.
 */

module.exports = FileWriter;

/**
 * The `FileWriter` class.
 *
 * @param {String} path The file path to write the WAVE file to
 * @param {Object} opts Object contains options for the stream and format info
 * @api public
 */

function FileWriter (path, opts) {
  if (!(this instanceof FileWriter)) return new FileWriter(path, opts);
  Writer.call(this, opts);
  this.path = path;
  this.file = fs.createWriteStream(path, opts);
  this.pipe(this.file);
  this.on('header', this._onHeader);
}
inherits(FileWriter, Writer);

/**
 * Writes the updated WAVE header to the beginning of the file.
 * Emits a "done" event when everything is all good.
 *
 * @api private
 */

FileWriter.prototype._onHeader = function (header) {
  var self = this, fd;

  function onOpen (err, f) {
    if (err) return self.emit('error', err);
    fd = f;
    fs.write(fd, header, 0, header.length, 0, onWrite);
  }

  function onWrite (err, bytesWritten) {
    if (err) return self.emit('error', err);
    if (bytesWritten != header.length) {
      return self.emit('error', new Error('problem writing "header" data'));
    }
    fs.close(fd, onClose);
  }

  function onClose (err) {
    if (err) return self.emit('error', err);
    self.emit('done');
  }
};
