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

    programSpecs: {
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

    drawProgram: function (program) {
      var self = this;

      program.gl.useProgram(program);
      if (program.uniforms.doShade) {
        program.gl.uniform1i(program.uniforms.doShade, 1);
      }
      Animation.prototype.drawProgram.apply(self, arguments);
    },

    getDrawMode: function (program) {
      var self = this;
      return program.gl.POINTS;
    }
  });
  Animation.animationClasses.point = PointAnimation;

  return PointAnimation;
});
