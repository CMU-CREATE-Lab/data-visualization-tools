define(["require", "Class", "Visualization/GeoProjection", "Visualization/Shader", "Visualization/Animation/Animation"], function(require, Class, GeoProjection, Shader, Animation) {
  var PointAnimation = Class(Animation, {
    magnitudeScale: 0.1,

    initGl: function(gl, cb) {
      var self = this;
      self.gl = gl;
      Shader.createShaderProgramFromUrl(
        self.gl,
        require.toUrl("Visualization/Animation/PointAnimation-vertex.glsl"),
        require.toUrl("Visualization/Animation/PointAnimation-fragment.glsl"),
        function (program) {
          self.program = program;

          self.pointArrayBuffer = self.gl.createBuffer();
          self.colorArrayBuffer = self.gl.createBuffer();
          self.magnitudeArrayBuffer = self.gl.createBuffer();
          self.timeArrayBuffer = self.gl.createBuffer();

          cb();
        }
      );
    },

    updateData: function() {
      var self = this;
      var format = self.manager.visualization.data.format;
      var header = format.header;
      var data = format.data;

      // For convenience we store POINT_COUNT in an element at the end
      // of the array, so that the length of each series is
      // rawSeries[i+1]-rawSeries[i].      
      self.rawSeries = new Int32Array(format.seriescount + 1);
      self.rawSeries[0] = 0;
      self.rawLatLonData = new Float32Array(header.length*2);
      self.rawColorData = new Float32Array(header.length*4);
      self.rawMagnitudeData = new Float32Array(header.length);
      self.rawTimeData = new Float32Array(header.length);
      self.lastSeries = function () {}; // Value we will never find in the data

      self.series_count = 0;
      for (var rowidx = 0; rowidx < header.length; rowidx++) {
        var series = data.series && data.series[rowidx];
        if (self.lastSeries != series) {
          self.series_count++;
          self.lastSeries = series;
        }

        var pixel = GeoProjection.LatLongToPixelXY(data.latitude[rowidx], data.longitude[rowidx]);
        self.rawLatLonData[2*rowidx] = pixel.x;
        self.rawLatLonData[2*rowidx+1] = pixel.y;

        if (   data.red != undefined
            && data.green != undefined
            && data.blue != undefined) {
          self.rawColorData[4*rowidx + 0] = data.red[rowidx] / 256;
          self.rawColorData[4*rowidx + 1] = data.green[rowidx] / 256;
          self.rawColorData[4*rowidx + 2] = data.blue[rowidx] / 256;
        } else {
          self.rawColorData[4*rowidx + 0] = 0.82
          self.rawColorData[4*rowidx + 1] = 0.22;
          self.rawColorData[4*rowidx + 2] = 0.07;
        }
        if (data.alpha != undefined) {
          self.rawColorData[4*rowidx + 3] = data.alpha[rowidx] / 256;
        } else {
          self.rawColorData[4*rowidx + 3] = 1;
        }

        if (data.magnitude != undefined) {
          self.rawMagnitudeData[rowidx] = 1 + self.magnitudeScale * data.magnitude[rowidx] / 256;
        } else {
          self.rawMagnitudeData[rowidx] = 1;
        }

        self.rawTimeData[rowidx] = data.datetime[rowidx];

        self.rawSeries[self.series_count] = rowidx + 1;
      }

      self.gl.useProgram(self.program);
      Shader.programLoadArray(self.gl, self.pointArrayBuffer, self.rawLatLonData, self.program);
      Shader.programLoadArray(self.gl, self.colorArrayBuffer, self.rawColorData, self.program);
      Shader.programLoadArray(self.gl, self.magnitudeArrayBuffer, self.rawMagnitudeData, self.program);
      Shader.programLoadArray(self.gl, self.timeArrayBuffer, self.rawTimeData, self.program);
    },

    draw: function () {
      var self = this;

      self.gl.useProgram(self.program);

      Shader.programBindArray(self.gl, self.pointArrayBuffer, self.program, "worldCoord", 2, self.gl.FLOAT);
      Shader.programBindArray(self.gl, self.colorArrayBuffer, self.program, "color", 4, self.gl.FLOAT);
      Shader.programBindArray(self.gl, self.magnitudeArrayBuffer, self.program, "magnitude", 1, self.gl.FLOAT);
      Shader.programBindArray(self.gl, self.timeArrayBuffer, self.program, "time", 1, self.gl.FLOAT);

      // pointSize range [5,20], 21 zoom levels
      var pointSize = Math.max(
        Math.floor( ((20-5) * (self.manager.map.zoom - 0) / (21 - 0)) + 5 ),
        GeoProjection.getPixelDiameterAtLatitude(self.manager.visualization.state.getValue("resolution") || 1000, self.manager.map.getCenter().lat(), self.manager.map.zoom));
      self.gl.uniform1f(self.program.uniforms.pointSize, pointSize*1.0);

      self.gl.uniformMatrix4fv(self.program.uniforms.mapMatrix, false, self.manager.mapMatrix);
      self.gl.uniform1f(self.program.uniforms.startTime, self.manager.visualization.state.getValue("time") - (self.manager.visualization.state.getValue("offset") * 24 * 60 * 60 * 1000));
      self.gl.uniform1f(self.program.uniforms.endTime, self.manager.visualization.state.getValue("time"));

      var mode = self.getDrawMode();
      for (var i = 0; i < self.series_count; i++) {
        self.gl.drawArrays(mode, self.rawSeries[i], self.rawSeries[i+1]-self.rawSeries[i]);
      }
    },

    getDrawMode: function () {
      var self = this;

      self.gl.uniform1i(self.program.uniforms.doShade, 1);
      return self.gl.POINTS;
    }
  });
  Animation.animationClasses.point = PointAnimation;

  return PointAnimation;
});
