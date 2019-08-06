// WorkersWorker.js
// Web worker code used under direction from Workers.js

filesLoaded = {}
operations = {}

// Handle request from main thread
function handleCall(e) {
  // Load required file, if not already loaded
  if (!filesLoaded[e.data.filename]) {
    importScripts(e.data.filename);
    filesLoaded[e.data.filename] = true;
  }

  // Perform requested operation
  var ret;
  if (operations[e.data.operation]) {
    ret = operations[e.data.operation](e.data.data);
  } else {
    ret = 'No such operation';
  }

  // Respond to main thread
  self.postMessage({seq: e.data.seq, data: ret});
}

self.addEventListener('message', handleCall);
