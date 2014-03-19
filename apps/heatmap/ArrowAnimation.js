function ArrowAnimation () {
  Animation();
}
ArrowAnimation.prototype = new Animation();
Animation.animationClasses.arrow = ArrowAnimation;

ArrowAnimation.prototype.magnitudeScale = 0.05;

ArrowAnimation.prototype.initGl = function(gl, cb) {
  var animation = this;
  animation.gl = gl;
  createShaderProgramFromUrl(animation.gl, "ArrowAnimation-vertex.glsl", "ArrowAnimation-fragment.glsl", function (program) {
    animation.program = program;

    animation.pointArrayBuffer = animation.gl.createBuffer();
    animation.headingArrayBuffer = animation.gl.createBuffer();
    animation.colorArrayBuffer = animation.gl.createBuffer();
    animation.magnitudeArrayBuffer = animation.gl.createBuffer();
    animation.timeArrayBuffer = animation.gl.createBuffer();

    cb();
  });
}
ArrowAnimation.prototype.header = function(header) {
  var animation = this;
  animation.series_count = 0;
  // For convenience we store POINT_COUNT in an element at the end
  // of the array, so that the length of each series is
  // rawSeries[i+1]-rawSeries[i].      
  animation.rawSeries = new Int32Array((header.series || 1) + 1);
  animation.rawSeries[0] = 0;
  animation.rawLatLonData = new Float32Array(header.length*4);
  animation.rawHeadingData = new Float32Array(header.length*2);
  animation.rawColorData = new Float32Array(header.length*8);
  animation.rawMagnitudeData = new Float32Array(header.length*2);
  animation.rawTimeData = new Float32Array(header.length*2);
  animation.lastSeries = function () {}; // Value we will never find in the data
}
ArrowAnimation.prototype.row = function(rowidx, data) {
  var animation = this;
  if (animation.lastSeries != data.series) {
    animation.series_count++;
    animation.lastSeries = data.series;
  }

  var pixel = LatLongToPixelXY(data.latitude, data.longitude);
  animation.rawLatLonData[4*rowidx] = pixel.x;
  animation.rawLatLonData[4*rowidx+1] = pixel.y;
  animation.rawLatLonData[4*rowidx+2] = pixel.x;
  animation.rawLatLonData[4*rowidx+3] = pixel.y;

  if (   data.red != undefined
      && data.green != undefined
      && data.blue != undefined) {
    animation.rawColorData[8*rowidx + 0] = data.red / 256;
    animation.rawColorData[8*rowidx + 1] = data.green / 256;
    animation.rawColorData[8*rowidx + 2] = data.blue / 256;
  } else {
    animation.rawColorData[8*rowidx + 0] = 0.82
    animation.rawColorData[8*rowidx + 1] = 0.22;
    animation.rawColorData[8*rowidx + 2] = 0.07;
  }
  if (data.alpha != undefined) {
    animation.rawColorData[8*rowidx + 3] = data.alpha / 256;
  } else {
    animation.rawColorData[8*rowidx + 3] = 1;
  }
  animation.rawColorData[8*rowidx + 4] = animation.rawColorData[8*rowidx + 0];
  animation.rawColorData[8*rowidx + 5] = animation.rawColorData[8*rowidx + 1];
  animation.rawColorData[8*rowidx + 6] = animation.rawColorData[8*rowidx + 2];
  animation.rawColorData[8*rowidx + 7] = animation.rawColorData[8*rowidx + 3];

  // -1 signifies that this is the first point in a linesegment making up an arrow, so not an actual heading
  animation.rawHeadingData[2*rowidx] = -1;
  animation.rawHeadingData[2*rowidx+1] = data.heading || 0;

  if (data.magnitude != undefined) {
      animation.rawMagnitudeData[2* rowidx] = animation.magnitudeScale * data.magnitude / 256;
  } else {
    animation.rawMagnitudeData[2 * rowidx] = animation.magnitudeScale;
  }
  animation.rawMagnitudeData[2 * rowidx + 1] = animation.rawMagnitudeData[2 * rowidx];

  animation.rawTimeData[2*rowidx] = data.datetime;
  animation.rawTimeData[2*rowidx+1] = data.datetime;

  animation.rawSeries[animation.series_count] = rowidx + 1;
}
ArrowAnimation.prototype.batch = function() {
  var animation = this;
  animation.gl.useProgram(animation.program);
  programLoadArray(animation.gl, animation.pointArrayBuffer, animation.rawLatLonData, animation.program);
  programLoadArray(animation.gl, animation.colorArrayBuffer, animation.rawColorData, animation.program);
  programLoadArray(animation.gl, animation.headingArrayBuffer, animation.rawHeadingData, animation.program);
  programLoadArray(animation.gl, animation.magnitudeArrayBuffer, animation.rawMagnitudeData, animation.program);
  programLoadArray(animation.gl, animation.timeArrayBuffer, animation.rawTimeData, animation.program);
}
ArrowAnimation.prototype.draw = function () {
  var animation = this;

  animation.gl.useProgram(animation.program);
  programBindArray(animation.gl, animation.pointArrayBuffer, animation.program, "worldCoord", 2, animation.gl.FLOAT);
  programBindArray(animation.gl, animation.colorArrayBuffer, animation.program, "color", 4, animation.gl.FLOAT);
  programBindArray(animation.gl, animation.headingArrayBuffer, animation.program, "heading", 1, animation.gl.FLOAT);
  programBindArray(animation.gl, animation.magnitudeArrayBuffer, animation.program, "magnitude", 1, animation.gl.FLOAT);
  programBindArray(animation.gl, animation.timeArrayBuffer, animation.program, "time", 1, animation.gl.FLOAT);

  // pointSize range [5,20], 21 zoom levels
  var pointSize = Math.max(
    Math.floor( ((20-5) * (animation.visualization.map.zoom - 0) / (21 - 0)) + 5 ),
    getPixelDiameterAtLatitude(animation.visualization.header.resolution || 1000, animation.visualization.map.getCenter().lat(), animation.visualization.map.zoom));
  animation.gl.vertexAttrib1f(animation.program.attributes.aPointSize, pointSize*1.0);

  animation.gl.uniformMatrix4fv(animation.program.uniforms.mapMatrix, false, animation.visualization.mapMatrix);
  animation.gl.uniform1f(animation.program.uniforms.startTime, animation.visualization.current_time - (animation.visualization.currentOffset * 24 * 60 * 60));
  animation.gl.uniform1f(animation.program.uniforms.endTime, animation.visualization.current_time);

  for (var i = 0; i < animation.series_count; i++) {
    animation.gl.drawArrays(animation.gl.LINES, animation.rawSeries[i]*2, animation.rawSeries[i+1]*2-animation.rawSeries[i]*2);
  }
}
