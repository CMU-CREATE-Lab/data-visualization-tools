define(["require", "app/Class", "app/Visualization/GeoProjection", "app/Visualization/Shader", "app/Visualization/Animation/Animation"], function(require, Class, GeoProjection, Shader, Animation) {
  var ArrowAnimation = Class(Animation, {
    name: "ArrowAnimation",

    columns: {
      point: {
        type: "Float32", hidden: true,
        items: [
          {name: "longitude_start", source: {longitude: 1.0}},
          {name: "latitude_start", source: {latitude: 1.0}},
          {name: "longitude_end", source: {longitude: 1.0}},
          {name: "latitude_end", source: {latitude: 1.0}}
        ],
        transform: function (col, offset) {
          var spec = this;
          var longitude_start = col[offset + spec.itemsByName.longitude_start.index];
          var latitude_start = col[offset + spec.itemsByName.latitude_start.index];
          var longitude_end = col[offset + spec.itemsByName.longitude_end.index];
          var latitude_end = col[offset + spec.itemsByName.latitude_end.index];

          var pixel_start = GeoProjection.LatLongToPixelXY(latitude_start, longitude_start);
          var pixel_end = GeoProjection.LatLongToPixelXY(latitude_end, longitude_end);

          col[offset + spec.itemsByName.latitude_start.index] = pixel_start.y;
          col[offset + spec.itemsByName.longitude_start.index] = pixel_start.x;
          col[offset + spec.itemsByName.latitude_end.index] = pixel_end.y;
          col[offset + spec.itemsByName.longitude_end.index] = pixel_end.x;
        }
      },
      color: {type: "Float32", items: [
        {name: "red_start", source: {_:1.0}, min: 0.0, max: 1.0},
        {name: "green_start", source: {_: 0.0}, min: 0.0, max: 1.0},
        {name: "blue_start", source: {_: 0.0}, min: 0.0, max: 1.0},
        {name: "alpha_start", source: {_: 1.0}, min: 0.0, max: 1.0},
        {name: "red_end", source: {_: 0.0}, min: 0.0, max: 1.0},
        {name: "green_end", source: {_: 0.0}, min: 0.0, max: 1.0},
        {name: "blue_end", source: {_: 1.0}, min: 0.0, max: 1.0},
        {name: "alpha_end", source: {_: 1.0}, min: 0.0, max: 1.0}]},
      heading: {type: "Float32", items: [
        {name: "dummy", hidden: true, source: {_:-1}, min: -1, max: -1},
        {name: "heading", source: {score: 1.0}, min: 0.0, max: 10.0}]},
      magnitude: {type: "Float32", items: [
        {name: "dummy", hidden: true, source: {_: -1}, min: -1, max: -1},
        {name: "magnitude", source: {score: 0.2}, min: 0.0, max: 2.0}]},
      time: {type: "Float32", hidden: true, items: [
        {name: "start", source: {datetime: 1.0}},
        {name: "end", source: {datetime: 1.0}}]}
    },

    initGl: function(gl, cb) {
      var self = this;
      Animation.prototype.initGl(gl, function () {
        Shader.createShaderProgramFromUrl(
          self.gl,
          require.toUrl("app/Visualization/Animation/ArrowAnimation-vertex.glsl"),
          require.toUrl("app/Visualization/Animation/ArrowAnimation-fragment.glsl"),
          function (program) {
            self.program = program;

            self.createDataViewArrayBuffers(self.program, [
                "point", "color", "heading", "magnitude", "time"
            ], 2);

            cb();
          }
        );
      });
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
      self.setGeneralUniforms(self.program);

      for (var i = 0; i < self.seriescount; i++) {
        self.gl.drawArrays(self.gl.LINES, self.rawSeries[i]*2, self.rawSeries[i+1]*2-self.rawSeries[i]*2);
      }
    }
  });
  Animation.animationClasses.arrow = ArrowAnimation;

  return ArrowAnimation;
});
