/**
 * Created by noamc on 8/31/14.
 */

navigator.getUserMedia  = navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia;

$(function() {
    var client;
    var recorder;
    var context;
    var bStream;

    $("#start-rec-btn").click(function(){
        client = new BinaryClient('ws://localhost:9001');
        client.on('open', function() {
            bStream= client.createStream();
        });

        if(context)
        {
            recorder.connect(context.destination);
            return;
        }

        var session = {
            audio: true,
            video: false
        };


        navigator.getUserMedia(session, function(stream){
            var audioContext = window.AudioContext;
            context = new audioContext();
            var audioInput = context.createMediaStreamSource(stream);
            var bufferSize = 2048;

            recorder = context.createScriptProcessor(bufferSize, 1, 1);

            recorder.onaudioprocess = onAudio;

            audioInput.connect(recorder);

            recorder.connect(context.destination);

        },function(e){

        });
    });

    function onAudio(e) {
        if(!bStream || !bStream.writable)
            return;

        var left = e.inputBuffer.getChannelData(0);

        var canvas = document.getElementById("canvas");
        drawBuffer( canvas.width, canvas.height, canvas.getContext('2d'), left );

        bStream.write(convertFloat32ToInt16(left));
    }

    function convertFloat32ToInt16(buffer) {
        var l = buffer.length;
        var buf = new Int16Array(l);
        while (l--) {
            buf[l] = Math.min(1, buffer[l])*0x7FFF;
        }
        return buf.buffer;
    }

    function drawBuffer( width, height, context, data ) {
        context.clearRect ( 0 , 0 , width , height );
        //var data = buffer.getChannelData( 0 );
        var step = Math.ceil( data.length / width );
        var amp = height / 2;
        for(var i=0; i < width; i++){
            var min = 1.0;
            var max = -1.0;
            for (var j=0; j<step; j++) {
                var datum = data[(i*step)+j];
                if (datum < min)
                    min = datum;
                if (datum > max)
                    max = datum;
            }
            context.fillRect(i,(1+min)*amp,1,Math.max(1,(max-min)*amp));
        }
    }

    $("#stop-rec-btn").click(function() {
        recorder.disconnect();
        client.close();
    });
});