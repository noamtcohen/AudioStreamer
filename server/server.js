/**
 * Created by noamc on 8/31/14.
 */
var binaryServer = require('binaryjs').BinaryServer;
var https = require('https');
var wav = require('wav');
var opener = require('opener');

var fs = require('fs');
if(!fs.existsSync("recordings"))
    fs.mkdirSync("recordings");

var options = {
    key:    fs.readFileSync('ssl/server.key'),
    cert:   fs.readFileSync('ssl/server.crt'),
};

var connect = require('connect');
var app = connect();

var serveStatic = require('serve-static');
app.use(serveStatic('public'));

var server = https.createServer(options,app);
server.listen(9191);

opener("https://localhost:9191");

var server = binaryServer({server:server});

server.on('connection', function(client) {
    console.log("new connection...");
    var fileWriter = null;

    client.on('stream', function(stream, meta) {

        console.log("Stream Start@" + meta.sampleRate +"Hz");
        var fileName = "recordings/"+ new Date().getTime()  + ".wav"
        fileWriter = new wav.FileWriter(fileName, {
            channels: 1,
            sampleRate: meta.sampleRate,
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
