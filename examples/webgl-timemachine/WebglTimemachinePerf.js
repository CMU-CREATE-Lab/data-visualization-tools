function WebglTimemachinePerf(canvas, timelapse) {
  this._canvas = canvas;
  this._context = this._canvas.getContext('2d');
  this._context.font = '10px Arial';
  this._timelapse = timelapse;
  console.log(this._height);
  this._traceCount = 3;
  this._trace = this._traceCount - 1;
  this._lastFrameStartTime = 1e10;
  this._traceHeight = Math.floor(this._canvas.height / this._traceCount);
  WebglTimemachinePerf.instance = this;
};

WebglTimemachinePerf.prototype.
startFrame = function() {
  this._frameStartTime = this._timelapse.getTimeIncludingDwells();
  if (this._frameStartTime < this._lastFrameStartTime) {
    this._endTrace();
    this._startTrace();
  }
  this._videoFrameCaptureDurations.push([]);
  this._lastFrameStartTime = this._frameStartTime;
  this._frameStartPerf = performance.now();
}

WebglTimemachinePerf.prototype.
endFrame = function() {
  var duration = performance.now() - this._frameStartPerf;
  this._context.beginPath();
  var x = Math.round(this._frameStartTime * 60 * 3) + 0.5;

  var captureDurations = 
    this._videoFrameCaptureDurations[this._videoFrameCaptureDurations.length - 1];
  
  var y = this._baseline;
  
  for (var i = 0; i < captureDurations.length; i++) {
    this._context.strokeStyle=['#cc0000', 'white'][i % 2];

    this._context.beginPath();
    this._context.moveTo(x, y);
    y -= captureDurations[i];
    this._context.lineTo(x, y);
    this._context.stroke();
  }

    this._context.beginPath();
  this._context.strokeStyle='black';
  this._context.moveTo(x, y);
  this._context.lineTo(x, this._baseline - duration);
  this._context.stroke();
  
  this._maxX = x;
}

WebglTimemachinePerf.prototype.
recordVideoFrameCapture = function(duration) {
  this._videoFrameCaptureDurations[this._videoFrameCaptureDurations.length - 1]
    .push(duration);
}

WebglTimemachinePerf.prototype.
recordMissedFrames = function(count) {
  this._missedFrameCount += count;
}

WebglTimemachinePerf.prototype.
_startTrace = function() {
  this._trace = (this._trace + 1) % this._traceCount;
  this._baseline = this._traceHeight * (this._trace + 1);
  this._context.clearRect(0, this._baseline - this._traceHeight, 
                          this._canvas.width, this._traceHeight);
  this._videoFrameCaptureDurations = [];
  this._missedFrameCount = 0;
}

WebglTimemachinePerf.prototype.
_endTrace = function() {
  function r2(x) {
    return Math.round(x * 100) / 100;
  }

  if (this._baseline != null) {
    var sum = 0;
    var sumsq = 0;
    var max = 0;
    var n = this._videoFrameCaptureDurations.length;
    for (var i = 0; i < n; i++) {
      var x = this._videoFrameCaptureDurations[i].length;
      sum += x;
      sumsq += x * x;
      max = Math.max(x, max);
    }
    var stddev = Math.sqrt((sumsq / n) - (sum / n) * (sum / n));
    msg = sum + ' frames ' +
    ' (missed ' + r2(this._missedFrameCount * 100 / (sum + this._missedFrameCount)) + '%' +
    ', stddev ' + r2(stddev) + 
    ', max ' + max + ')';
    console.log(msg);
    this._context.fillText(msg, this._maxX + 6, this._baseline);
  }
}

