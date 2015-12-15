/**
 * Created by noam on 12/15/15.
 */

importScripts('resampler.js');

var _resampler;

self.addEventListener('message', function(e) {
    if(e.data.cmd=="init"){
        var info = e.data;
        _resampler = new Resampler({originalSampleRate:info.from,resampledRate:info.to,numberOfChannels:1})
    }
    if(e.data.cmd=="resample"){
        var resampled = _resampler.resample(e.data.buffer,0);
        self.postMessage({buffer:resampled},[resampled.buffer]);
    }
}, false);