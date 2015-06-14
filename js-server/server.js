/**
 * Created by noamc on 8/31/14.
 */
var binaryServer = require('binaryjs').BinaryServer;
var wav = require('wav');

var connect = require('connect');
var serveStatic = require('serve-static');
connect().use(serveStatic('.')).listen(8080);

var server = binaryServer({port: 9001});

server.on('connection', function(client) {
    console.log("new connection...");
    var fileWriter = null;

    client.on('stream', function(stream, meta) {
        console.log("Stream Start")
        var fileName = "recordings/"+ new Date().getTime()  + ".wav"
        fileWriter = new wav.FileWriter(fileName, {
            channels: 1,
            sampleRate: 44100,
            bitDepth: 16
        });

        stream.pipe(fileWriter);
    });

    client.on('close', function() {
        if (fileWriter != null) {
            fileWriter.end();
        }
        console.log("Connection Closed");
    });
});
