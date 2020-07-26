// Workers.js
//
// Maintain a common set of web workers and queue operations to them with callback.
//
// Amortizes the significant latency of creating a WebWorker across many requests.

export class Workers {
  // Public interface
  static call(filename: string, operation: string, data: any, callback: (data: any) => void) {
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
  }
  
  // Private

  static _workers = null;
  static _seq = 0;         // Unique sequence # for each worker invocation
  static _callbacks: {[seq: number]: (data: any) => void} = {};   // Callbacks, by sequence #, for each in-progress worker call

  // Dispatch worker response to correct callback
  static _handleResponse(e: MessageEvent) {
    (Workers._callbacks[e.data.seq])(e.data.data);
    delete Workers._callbacks[e.data.seq];
  }

  // Create workers if we haven't already
  static _createIfNeeded() {
      if (!Workers._workers) {
      Workers._workers = [];
      var numWorkers = 12;
      for (var i = 0; i < numWorkers; i++) {
        var worker = new Worker('WorkersWorker.js');
        worker.onmessage = Workers._handleResponse;
        Workers._workers.push(worker);
      }
    }
  }
}