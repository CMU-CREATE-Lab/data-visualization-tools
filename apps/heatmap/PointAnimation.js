function PointAnimation () {
  Animation();
}
PointAnimation.prototype = new Animation();
Animation.animationClasses.point = PointAnimation;

PointAnimation.prototype.magnitudeScale = 8;

PointAnimation.prototype.initGl = function(gl, cb) {
  var animation = this;
  animation.gl = gl;
  createShaderProgramFromUrl(animation.gl, "PointAnimation-vertex.glsl", "PointAnimation-fragment.glsl", function (program) {
    animation.program = program;

    animation.pointArrayBuffer = animation.gl.createBuffer();
    animation.colorArrayBuffer = animation.gl.createBuffer();
    animation.magnitudeArrayBuffer = animation.gl.createBuffer();
    animation.timeArrayBuffer = animation.gl.createBuffer();

    cb();
  });
}
PointAnimation.prototype.header = function(header) {
  var animation = this;
  animation.series_count = 0;
  // For convenience we store POINT_COUNT in an element at the end
  // of the array, so that the length of each series is
  // rawSeries[i+1]-rawSeries[i].      
  animation.rawSeries = new Int32Array((header.series || 1) + 1);
  animation.rawSeries[0] = 0;
  animation.rawLatLonData = new Float32Array(header.length*2);
  animation.rawColorData = new Float32Array(header.length*4);
  animation.rawMagnitudeData = new Float32Array(header.length);
  animation.rawTimeData = new Float32Array(header.length);
  animation.lastSeries = function () {}; // Value we will never find in the data
}
PointAnimation.prototype.row = function(rowidx, data) {
  var animation = this;
  if (animation.lastSeries != data.series) {
    animation.series_count++;
    animation.lastSeries = data.series;
  }

  var pixel = LatLongToPixelXY(data.latitude, data.longitude);
  animation.rawLatLonData[2*rowidx] = pixel.x;
  animation.rawLatLonData[2*rowidx+1] = pixel.y;

  if (   data.red != undefined
      && data.green != undefined
      && data.blue != undefined) {
    animation.rawColorData[4*rowidx + 0] = data.red / 256;
    animation.rawColorData[4*rowidx + 1] = data.green / 256;
    animation.rawColorData[4*rowidx + 2] = data.blue / 256;
  } else {
    animation.rawColorData[4*rowidx + 0] = 0.82
    animation.rawColorData[4*rowidx + 1] = 0.22;
    animation.rawColorData[4*rowidx + 2] = 0.07;
  }
  if (data.alpha != undefined) {
    animation.rawColorData[4*rowidx + 3] = data.alpha / 256;
  } else {
    animation.rawColorData[4*rowidx + 3] = 1;
  }

  if (data.magnitude != undefined) {
      animation.rawMagnitudeData[rowidx] = 1 + animation.magnitudeScale * data.magnitude / 256;
  } else {
    animation.rawMagnitudeData[rowidx] = 1;
  }

  animation.rawTimeData[rowidx] = data.datetime;

  animation.rawSeries[animation.series_count] = rowidx + 1;
}
PointAnimation.prototype.batch = function() {
  var animation = this;
  animation.gl.useProgram(animation.program);
  programLoadArray(animation.gl, animation.pointArrayBuffer, animation.rawLatLonData, animation.program, "worldCoord", 2, animation.gl.FLOAT);
  programLoadArray(animation.gl, animation.colorArrayBuffer, animation.rawColorData, animation.program, "color", 4, animation.gl.FLOAT);
  programLoadArray(animation.gl, animation.magnitudeArrayBuffer, animation.rawMagnitudeData, animation.program, "magnitude", 1, animation.gl.FLOAT);
  programLoadArray(animation.gl, animation.timeArrayBuffer, animation.rawTimeData, animation.program, "time", 1, animation.gl.FLOAT);
}
PointAnimation.prototype.draw = function () {
  var animation = this;

  animation.gl.useProgram(animation.program);

  // pointSize range [5,20], 21 zoom levels
  var pointSize = Math.max(
    Math.floor( ((20-5) * (animation.visualization.map.zoom - 0) / (21 - 0)) + 5 ),
    getPixelDiameterAtLatitude(animation.visualization.header.resolution || 1000, animation.visualization.map.getCenter().lat(), animation.visualization.map.zoom));
  animation.gl.vertexAttrib1f(animation.program.attributes.aPointSize, pointSize*1.0);

  var mapProjection = animation.visualization.map.getProjection();

  /**
   * We need to create a transformation that takes world coordinate
   * points in the pointArrayBuffer to the coodinates WebGL expects.
   * 1. Start with second half in pixelsToWebGLMatrix, which takes pixel
   *     coordinates to WebGL coordinates.
   * 2. Scale and translate to take world coordinates to pixel coords
   * see https://developers.google.com/maps/documentation/javascript/maptypes#MapCoordinate
   */

  // copy pixel->webgl matrix
  animation.visualization.mapMatrix.set(animation.visualization.pixelsToWebGLMatrix);

  var scale = animation.visualization.canvasLayer.getMapScale();
  scaleMatrix(animation.visualization.mapMatrix, scale, scale);

  var translation = animation.visualization.canvasLayer.getMapTranslation();
  translateMatrix(animation.visualization.mapMatrix, translation.x, translation.y);


  // attach matrix value to 'mapMatrix' uniform in shader
  animation.gl.uniformMatrix4fv(animation.program.uniforms.mapMatrix, false, animation.visualization.mapMatrix);

  animation.gl.uniform1f(animation.program.uniforms.startTime, animation.visualization.current_time - (animation.visualization.currentOffset * 24 * 60 * 60));
  animation.gl.uniform1f(animation.program.uniforms.endTime, animation.visualization.current_time);

  var mode = animation.getDrawMode();
  for (var i = 0; i < animation.series_count; i++) {
    animation.gl.drawArrays(mode, animation.rawSeries[i], animation.rawSeries[i+1]-animation.rawSeries[i]);
  }
}
PointAnimation.prototype.getDrawMode = function () {
  var animation = this;

  animation.gl.uniform1i(animation.program.uniforms.doShade, 1);
  return animation.gl.POINTS;
}


function LineAnimation () {
  PointAnimation();
}
LineAnimation.prototype = new PointAnimation();
Animation.animationClasses.line = LineAnimation;

LineAnimation.prototype.getDrawMode = function () {
  var animation = this;

  animation.gl.uniform1i(animation.program.uniforms.doShade, 0);
  return animation.gl.LINE_STRIP;
}
