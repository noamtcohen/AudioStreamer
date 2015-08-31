//https://github.com/notthetup/resampler

function reSample(audioBuffer, targetSampleRate, onComplete) {
    var channel = audioBuffer.numberOfChannels;
    var samples = audioBuffer.length * targetSampleRate / audioBuffer.sampleRate;

    var offlineContext = new OfflineAudioContext(channel, samples, targetSampleRate);
    var bufferSource = offlineContext.createBufferSource();
    bufferSource.buffer = audioBuffer;

    bufferSource.connect(offlineContext.destination);
    bufferSource.start(0);
    offlineContext.startRendering().then(function(renderedBuffer){
        onComplete(renderedBuffer);
    })
}
