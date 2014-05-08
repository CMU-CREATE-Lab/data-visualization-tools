define(["require", "app/Class", "app/Visualization/GeoProjection", "app/Visualization/Shader", "app/Visualization/Animation/Animation"], function(require, Class, GeoProjection, Shader, Animation) {
  var PointAnimation = Class(Animation, {
    name: "PointAnimation",

    columns: {
      point: {
        type: "Float32",
        items: [
          {name: "longitude", source: {longitude: 1.0}},
          {name: "latitude", source: {latitude: 1.0}}
        ],
        transform: function (col, offset) {
          var spec = this;
          var longitude = col[offset + spec.itemsByName.longitude.index];
          var latitude = col[offset + spec.itemsByName.latitude.index];

          var pixel = GeoProjection.LatLongToPixelXY(latitude, longitude);

          col[offset + spec.itemsByName.latitude.index] = pixel.y;
          col[offset + spec.itemsByName.longitude.index] = pixel.x;
        }
      },
      color: {type: "Float32", items: [
        {name: "red", source: {score: 0.85, _:-0.1}, min: 0.0, max: 1.0},
        {name: "green", source: {_: 0.1}, min: 0.0, max: 1.0},
        {name: "blue", source: {_: 0.0}, min: 0.0, max: 1.0},
        {name: "alpha", source: {_: 1.0}, min: 0.0, max: 1.0}]},
      magnitude: {type: "Float32", items: [
        {name: "magnitude", source: {score: 5, _:2}, min: 0.0, max: 10.0}]},
      time: {type: "Float32", items: [
        {name: "datetime", source: {datetime: 1.0}}]}
    },

    magnitudeScale: 0.1,

    initGl: function(gl, cb) {
      var self = this;
      self.gl = gl;
      Shader.createShaderProgramFromUrl(
        self.gl,
        require.toUrl("app/Visualization/Animation/PointAnimation-vertex.glsl"),
        require.toUrl("app/Visualization/Animation/PointAnimation-fragment.glsl"),
        function (program) {
          self.program = program;

          self.createDataViewArrayBuffers(self.program, [
            "point", "color", "magnitude", "time"
          ]);

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
      self.lastSeries = function () {}; // Value we will never find in the data

      self.seriescount = 0;
      for (var rowidx = 0; rowidx < header.length; rowidx++) {
        var series = data.series && data.series[rowidx];
        if (self.lastSeries != series) {
          self.seriescount++;
          self.lastSeries = series;
        }
        self.rawSeries[self.seriescount] = rowidx + 1;
      }

      self.loadDataViewArrayBuffers(self.program);

      Animation.prototype.updateData.call(self);
    },

    draw: function () {
      var self = this;
      var time = self.manager.visualization.state.getValue("time");
      var offset = self.manager.visualization.state.getValue("offset");

      if (time == undefined) return;
      time = time.getTime();

      self.bindDataViewArrayBuffers(self.program);

      // pointSize range [5,20], 21 zoom levels
      var pointSize = Math.max(
        Math.floor( ((20-5) * (self.manager.map.zoom - 0) / (21 - 0)) + 5 ),
        GeoProjection.getPixelDiameterAtLatitude(self.manager.visualization.state.getValue("resolution") || 1000, self.manager.map.getCenter().lat(), self.manager.map.zoom));
      self.gl.uniform1f(self.program.uniforms.pointSize, pointSize*1.0);

      self.gl.uniformMatrix4fv(self.program.uniforms.mapMatrix, false, self.manager.mapMatrix);
      self.gl.uniform1f(self.program.uniforms.startTime, time - offset * 24 * 60 * 60 * 1000);
      self.gl.uniform1f(self.program.uniforms.endTime, time);

      var mode = self.getDrawMode();
      for (var i = 0; i < self.seriescount; i++) {
        // console.log([i, self.rawSeries[i], self.rawSeries[i+1]-self.rawSeries[i], self.manager.visualization.data.format.header.length]);
        self.gl.drawArrays(mode, self.rawSeries[i], self.rawSeries[i+1]-self.rawSeries[i]);
      }

      Animation.prototype.draw.call(self);
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
