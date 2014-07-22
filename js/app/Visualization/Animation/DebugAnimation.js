define(["require", "app/Class", "app/Visualization/Shader", "app/Visualization/Animation/Animation"], function(require, Class, Shader, Animation) {
  var DebugAnimation = Class(Animation, {
    name: "DebugAnimation",

    columns: {
      point: {
        type: "Float32", hidden: true,
        items: [
          {name: "longitude", source: {longitude: 1.0}},
          {name: "latitude", source: {latitude: 1.0}}
        ],
        transform: 'coordinate'
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
  Animation.animationClasses.DebugAnimation = DebugAnimation;

  return DebugAnimation;
});
