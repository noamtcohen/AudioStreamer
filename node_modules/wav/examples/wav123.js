
/**
 * Plays the WAVE audio file from stdin out the of the computer's speakers.
 * Only PCM format audio WAVE (codec 1) are supported.
 */

var Reader = require('../').Reader;
var Speaker = require('speaker');

var reader = new Reader();

reader.on('format', function (format) {
  console.error('format:', format);
  var s = new Speaker(format);
  reader.pipe(s);
});

reader.on('error', function (err) {
  console.error('Reader error: %s', err);
});

process.stdin.pipe(reader);
