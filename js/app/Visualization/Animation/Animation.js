define(["app/Class", "app/Visualization/Shader", "app/Data/DataView", "app/Visualization/DataViewUI"], function(Class, Shader, DataView, DataViewUI) {
  var Animation = Class({
    name: "Animation",
    columns: {
      point: {type: "Float32", items: [
        {name: "latitude", source: {latitude: 1.0}},
        {name: "longitude", source: {longitude: 1.0}}]},
      color: {type: "Float32", items: [
        {name: "red", source: {_: 1.0}},
        {name: "green", source: {_: 1.0}},
        {name: "blue", source: {_: 0.0}}]},
      magnitude: {type: "Float32", items: [
        {name: "magnitude", source: {_: 1.0}}]}
    },

    initialize: function(manager) {
      var self = this;
      self.manager = manager;
      self.data_view = new DataView(self.manager.visualization.data.format, self.columns);
      self.data_view_ui = new DataViewUI(self.data_view);
    },

    initGl: function(gl, cb) {
      var self = this;
      self.gl = gl;
      cb();
    },

    initUpdates: function(cb) {
      var self = this;
      self.data_view.events.on({
        "update": self.updateData.bind(self),
      });
      self.updateData();
      cb();
    },

    updateData: function () {
      var self = this;
      self.manager.triggerUpdate();
    },

    draw: function () {},

    createDataViewArrayBuffers: function (program, columns) {
      var self = this;
      program.dataViewArrayBuffers = {};
      columns.map(function (name) {
        program.dataViewArrayBuffers[name] = program.gl.createBuffer();
      });
    },

    loadDataViewArrayBuffers: function(program) {
      var self = this;
      program.gl.useProgram(program);

      for (var name in program.dataViewArrayBuffers) {
        Shader.programLoadArray(program.gl, program.dataViewArrayBuffers[name], self.data_view.data[name], program);
      };
    },

    bindDataViewArrayBuffers: function(program) {
      var self = this;
      program.gl.useProgram(program);
      for (var name in program.dataViewArrayBuffers) {
        Shader.programBindArray(program.gl, program.dataViewArrayBuffers[name], program, name, self.data_view.header.colsByName[name].items.length, self.gl.FLOAT);
      };
    }

  });

  Animation.animationClasses = {};

  return Animation;
});
