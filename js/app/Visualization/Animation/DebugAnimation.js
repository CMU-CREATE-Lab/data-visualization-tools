define(["require", "app/Class", "app/Visualization/GeoProjection", "app/Visualization/Shader", "app/Visualization/Animation/Animation"], function(require, Class, GeoProjection, Shader, Animation) {
  var DebugAnimation = Class(Animation, {
    name: "DebugAnimation",

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
      }
    },

    programSpecs: {
      program: {
        context: "gl",
        vertex: "app/Visualization/Animation/DebugAnimation-vertex.glsl",
        fragment: "app/Visualization/Animation/DebugAnimation-fragment.glsl",
        columns: ["point"]
      }
    },

    getDrawMode: function (program) {
      var self = this;
      return program.gl.POINTS;
    }
  });
  Animation.animationClasses.debug = DebugAnimation;

  return DebugAnimation;
});
