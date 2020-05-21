//data-worker.js
self.addEventListener('message', function(e) {
    var regexp = e.data['regexp'];
    var key = e.data['key'];
    var url_tmpl = e.data["url_tmpl"];
    var url = url_tmpl.replace(regexp,key);

    loadBinaryData(key, url, function(key, float32Array) {
        var message = {
            'error': false,
            'key': key,
            'array': float32Array.buffer
        }
        self.postMessage(message, [float32Array.buffer]);
    });
}, false);

function loadBinaryData(key, url, callback) {
    var float32Array;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function() {
        if (this.status >= 400) {
            float32Array = new Float32Array([]);
        } else {
            float32Array = new Float32Array(this.response);
        }
        callback(key, float32Array);
    }
    xhr.send();

}

