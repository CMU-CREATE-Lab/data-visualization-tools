function WebGLTimeMachinePerf(canvas, timelapse) {
  this._canvas = canvas;
  this._context = this._canvas.getContext('2d');
  this._context.font = '10px Arial';
  this._context2 = {
    beginPath: function(){},
    moveTo: function(){},
    lineTo: function(){},
    stroke: function(){},
    clearRect: function(){},
    fillText: function(){},
  };
  this._timelapse = timelapse;
  this._traceCount = 3;
  this._trace = this._traceCount - 1;
  this._lastFrameStartTime = 1e10;
  this._traceHeight = Math.floor((this._canvas.height - 3) / this._traceCount);
  WebGLTimeMachinePerf.instance = this;
  this._context.fillStyle = '#ffffff';
  this._context.fillRect(0, 0, this._canvas.width, this._canvas.height);
};

WebGLTimeMachinePerf.prototype.
startFrame = function() {
  this._frameStartTime = this._timelapse.getVideoset().getCurrentTime();
  if (this._frameStartTime < this._lastFrameStartTime) {
    this._endTrace();
    this._startTrace();
  }
  this._videoFrameCaptureDurations.push([]);
  this._lastFrameStartTime = this._frameStartTime;
  this._frameStartPerf = performance.now();
}

WebGLTimeMachinePerf.prototype.
endFrame = function() {
  var duration = performance.now() - this._frameStartPerf;
  this._context.beginPath();
  var x = Math.round((this._frameStartPerf - this._traceStartPerf) / 1000 * 60 * 3) + 0.5;

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
  
  this._lastX = x;
}

WebGLTimeMachinePerf.prototype.
recordVideoFrameCapture = function(duration) {
  this._videoFrameCaptureDurations[this._videoFrameCaptureDurations.length - 1]
    .push(duration);

  var bucket = Math.min(25, Math.round(duration));
  
  this._captureDurationHist[bucket] = 1 + (this._captureDurationHist[bucket] || 0);
}

WebGLTimeMachinePerf.prototype.
recordMissedFrames = function(count) {
  this._missedFrameCount += count;
}

WebGLTimeMachinePerf.prototype.
_startTrace = function() {
  this._traceStartPerf = performance.now();
  this._trace = (this._trace + 1) % this._traceCount;
  this._baseline = this._traceHeight * (this._trace + 1);

  this._context.fillStyle = '#ffffff';
  this._context.fillRect(0, this._baseline - this._traceHeight, 
                          this._canvas.width, this._traceHeight);
  this._videoFrameCaptureDurations = [];
  this._missedFrameCount = 0;
  this._captureDurationHist = [];
}

WebGLTimeMachinePerf.prototype.
_endTrace = function() {
  function r2(x) {
    return Math.round(x * 100) / 100;
  }

  if (this._baseline != null) {
    
    ////////////////////////////////
    // Capture duration histogram
    var totalWeighted = 0;
    var maxWeighted = 0;
    
    this._lastX = Math.round(this._lastX + 6);

    this._context.fillStyle = '#eeeeee';

    this._context.fillRect(this._lastX, this._baseline - this._traceHeight, 
                           10, this._traceHeight);

    this._context.fillStyle = '#ffdddd';

    this._context.fillRect(this._lastX + 20, this._baseline - this._traceHeight, 
                           10, this._traceHeight);
    this._context.fillRect(this._lastX + 40, this._baseline - this._traceHeight, 
                           10, this._traceHeight);

    for (var i = 0; i < this._captureDurationHist.length; i++) {
      if (this._captureDurationHist[i]) {
        var weighted = this._captureDurationHist[i] * i;
        totalWeighted += weighted;
        maxWeighted = Math.max(maxWeighted, weighted);
      }
    }
    
    for (var i = 0; i < this._captureDurationHist.length; i++) {
      if (this._captureDurationHist[i]) {
        this._context.beginPath();
        this._context.moveTo(this._lastX + i * 2 + 0.5, this._baseline);
        this._context.lineTo(this._lastX + i * 2 + 0.5, this._baseline - 40 * (this._captureDurationHist[i] * i) / maxWeighted);
        this._context.stroke();
      }
    }

    this._lastX += 50;

    ///////////////////////////
    // Text stats
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
    + r2(sum / 29) + ' videos ' +
    ' (missed ' + r2(this._missedFrameCount * 100 / (sum + this._missedFrameCount)) + '%' +
    ', stddev ' + r2(stddev) + 
    ', max ' + max + ')';
    //console.log(msg);
    this._context.fillStyle = '#000000';
    this._context.fillText(msg, this._lastX + 6, this._baseline - 5);

    this._context.strokeStyle = '#000080';

  }
}

