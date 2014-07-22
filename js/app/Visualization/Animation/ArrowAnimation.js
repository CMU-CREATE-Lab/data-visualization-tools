define(["require", "app/Class", "app/Visualization/Shader", "app/Visualization/Animation/Animation"], function(require, Class, Shader, Animation) {
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
        transform: "coordinate2"
      },
      color: {type: "Float32", items: [
        {name: "red_start", source: {_:1.0}, min: 0.0, max: 1.0},
        {name: "green_start", source: {_: 0.0, selected:1.0, hover:1.0}, min: 0.0, max: 1.0},
        {name: "blue_start", source: {_: 0.0, selected:1.0, hover:1.0}, min: 0.0, max: 1.0},
        {name: "alpha_start", source: {_: 1.0}, min: 0.0, max: 1.0},
        {name: "red_end", source: {_: 0.0, selected:1.0, hover:1.0}, min: 0.0, max: 1.0},
        {name: "green_end", source: {_: 0.0, selected:1.0, hover:1.0}, min: 0.0, max: 1.0},
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
        {name: "end", source: {datetime: 1.0}}]},
      rowidx: {
        type: "Float32", hidden: true,
        items: [
          {name: "sr", source: {}},
          {name: "sg", source: {}},
          {name: "sb", source: {}},
          {name: "sa", source: {}},
          {name: "er", source: {}},
          {name: "eg", source: {}},
          {name: "eb", source: {}},
          {name: "ea", source: {}}
        ],
        transform: "rowidx2"
      }
    },

    programSpecs: {
      program: {
        context: "gl",
        vertex: "app/Visualization/Animation/ArrowAnimation-vertex.glsl",
        fragment: "app/Visualization/Animation/ArrowAnimation-fragment.glsl",
        columns: ["point", "color", "heading", "magnitude", "time"],
        items_per_source_item: 2
      },
      rowidxProgram: {
        context: "rowidxGl",
        vertex: "app/Visualization/Animation/ArrowAnimation-rowidx-vertex.glsl",
        fragment: "app/Visualization/Animation/ArrowAnimation-rowidx-fragment.glsl",
        columns: ["point", "rowidx", "heading", "magnitude", "time"],
        items_per_source_item: 2
      }
    },

    getDrawMode: function (program) {
      var self = this;
      return program.gl.LINES;
    }
  });
  Animation.animationClasses.ArrowAnimation = ArrowAnimation;

  return ArrowAnimation;
});
