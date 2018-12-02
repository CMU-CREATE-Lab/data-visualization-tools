// Workers.js
//
// Maintain a common set of web workers and queue operations to them with callback.
//
// Amortizes the significant latency of creating a WebWorker across many requests.

Workers = {};

// Public interface

Workers.call = function(filename, operation, data, callback) {
  Workers._createIfNeeded();
  
  // Record callback, select worker, and send request
  Workers._callbacks[Workers._seq] = callback;
  Workers._workers[Workers._seq % Workers._workers.length].postMessage({
    filename: filename,
    operation: operation,
    data: data,
    seq: Workers._seq
  });
  Workers._seq++;
};

// Private

Workers._workers = null;
Workers._seq = 0;         // Unique sequence # for each worker invocation
Workers._callbacks= {};   // Callbacks, by sequence #, for each in-progress worker call

// Dispatch worker response to correct callback
Workers._handleResponse = function(e) {
  (Workers._callbacks[e.data.seq])(e.data.data);
  delete Workers._callbacks[e.seq];
}

// Create workers if we haven't already
Workers._createIfNeeded = function() {
  if (!Workers._workers) {
    Workers._workers = [];
    var numWorkers = 2;
    for (var i = 0; i < numWorkers; i++) {
      var worker = new Worker('WorkersWorker.js');
      worker.onmessage = Workers._handleResponse;
      Workers._workers.push(worker);
    }
  }
};



