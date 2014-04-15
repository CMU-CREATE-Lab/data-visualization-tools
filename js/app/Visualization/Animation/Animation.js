define(["Class"], function(Class) {
  var Animation = Class({
    initialize: function(manager) {
      var self = this;
      self.manager = manager;
    },

    initGl: function(gl, cb) {
      var self = this;
      self.gl = gl;
      cb();
    },

    initUpdates: function(cb) {
      var self = this;
      self.manager.visualization.data.format.events.on({
        "batch": self.updateData.bind(self),
        "full-tile": self.updateData.bind(self),
        "all": self.updateData.bind(self)
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
