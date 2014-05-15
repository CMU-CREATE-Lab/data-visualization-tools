define(["require", "app/Class", "app/Visualization/GeoProjection", "app/Visualization/Shader", "app/Visualization/Animation/Animation"], function(require, Class, GeoProjection, Shader, Animation) {
  var PointAnimation = Class(Animation, {
    name: "PointAnimation",

    columns: {
      point: {
        type: "Float32", hidden: true,
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
        {name: "red", source: {score: 0.85, _:-0.1, hover:1.0, selected:1.0}, min: 0.0, max: 1.0},
        {name: "green", source: {_: 0.3, hover:1.0, selected:1.0}, min: 0.0, max: 1.0},
        {name: "blue", source: {_: 0.0, hover:1.0, selected:1.0}, min: 0.0, max: 1.0},
        {name: "alpha", source: {_: 1.0}, min: 0.0, max: 1.0}]},
      magnitude: {type: "Float32", items: [
        {name: "magnitude", source: {score: 5, _:2}, min: 0.0, max: 10.0}]},
      time: {type: "Float32", hidden: true, items: [
        {name: "datetime", source: {datetime: 1.0}}]},
      rowidx: {
        type: "Float32", hidden: true,
        items: [
          {name: "r", source: {}},
          {name: "g", source: {}},
          {name: "b", source: {}},
          {name: "a", source: {}}
        ],
        transform: function (col, offset) {
          var spec = this;
          var rowidx = (offset / spec.items.length) + 1;

          col[offset + spec.itemsByName.r.index] = ((rowidx >> 16) & 0xff) / 255;
          col[offset + spec.itemsByName.g.index] = ((rowidx >> 8) & 0xff) / 255;
          col[offset + spec.itemsByName.b.index] = (rowidx & 0xff) / 255;
          col[offset + spec.itemsByName.a.index] = 1.0;
        }
      }
    },

    programs: {
      program: {
        context: "gl",
        vertex: "app/Visualization/Animation/PointAnimation-vertex.glsl",
        fragment: "app/Visualization/Animation/PointAnimation-fragment.glsl",
        columns: ["point", "color", "magnitude", "time"]
      },
      rowidxProgram: {
        context: "rowidxGl",
        vertex: "app/Visualization/Animation/PointAnimation-rowidx-vertex.glsl",
        fragment: "app/Visualization/Animation/PointAnimation-rowidx-fragment.glsl",
        columns: ["point", "rowidx", "magnitude", "time"]
      }
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
      self.loadDataViewArrayBuffers(self.rowidxProgram);

      Animation.prototype.updateData.call(self);
    },

    draw: function () {
      var self = this;
      Animation.prototype.draw.call(self);

      self.rowidxGl.clear(self.rowidxGl.COLOR_BUFFER_BIT);

      [self.program, self.rowidxProgram].map(function (program) { 

        self.bindDataViewArrayBuffers(program);
        self.setGeneralUniforms(program);

        var mode = self.getDrawMode(program);
        for (var i = 0; i < self.seriescount; i++) {
          program.gl.drawArrays(mode, self.rawSeries[i], self.rawSeries[i+1]-self.rawSeries[i]);
        }
      });
    },

    getDrawMode: function (program) {
      var self = this;

      program.gl.uniform1i(program.uniforms.doShade, 1);
      return program.gl.POINTS;
    }
  });
  Animation.animationClasses.point = PointAnimation;

  return PointAnimation;
});
