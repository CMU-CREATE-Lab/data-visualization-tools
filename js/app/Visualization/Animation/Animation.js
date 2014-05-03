define(["app/Class", "app/Data/DataView", "app/Visualization/DataViewUI"], function(Class, DataView, DataViewUI) {
  var Animation = Class({
    name: "Animation",
    columns: {
      points: {type: "Float32", items: [
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

    draw: function () {}
  });

  Animation.animationClasses = {};

  return Animation;
});
