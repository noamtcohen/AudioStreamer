/**
 * Created by noamc on 8/31/14.
 */
 var binaryServer = require('binaryjs').BinaryServer,
     https = require('https'),
     wav = require('wav'),
     opener = require('opener'),
     fs = require('fs'),
     connect = require('connect'),
     serveStatic = require('serve-static'),
     UAParser = require('./ua-parser'),
     CONFIG = require("../config.json"),
     lame = require('lame');

 var uaParser = new UAParser();

 if(!fs.existsSync("recordings"))
    fs.mkdirSync("recordings");

var options = {
    key:    fs.readFileSync('ssl/server.key'),
    cert:   fs.readFileSync('ssl/server.crt'),
};

var app = connect();

app.use(serveStatic('public'));

var server = https.createServer(options,app);
server.listen(9191);

opener("https://localhost:9191");

var server = binaryServer({server:server});

server.on('connection', function(client) {
    console.log("new connection...");
    var fileWriter = null;
    var writeStream = null;
    
    var userAgent  =client._socket.upgradeReq.headers['user-agent'];
    uaParser.setUA(userAgent);
    var ua = uaParser.getResult();

    client.on('stream', function(stream, meta) {

        console.log("Stream Start@" + meta.sampleRate +"Hz");
        var fileName = "recordings/"+ ua.os.name +"-"+ ua.os.version +"_"+ new Date().getTime();
        
        switch(CONFIG.AudioEncoding){
            case "WAV":
                fileWriter = new wav.FileWriter(fileName + ".wav", {
                    channels: 1,
                    sampleRate: meta.sampleRate,
                    bitDepth: 16 });
                stream.pipe(fileWriter);
            break;

            case "MP3":
                writeStream = fs.createWriteStream( fileName + ".mp3" );
                stream.pipe( new lame.Encoder(
                {
                    channels: 1, bitDepth: 16, sampleRate: meta.sampleRate, bitRate: 128, outSampleRate: 22050, mode: lame.MONO
                })
                )
                .pipe( writeStream );
            break;
        };

    });

    
    client.on('close', function() {
        if ( fileWriter != null ) {
            fileWriter.end();
        } else if ( writeStream != null ) {
            writeStream.end();
        }
        console.log("Connection Closed");
    });
});
