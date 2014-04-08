Animation = Class({
  initialize: function(manager) {
    var self = this;
    self.manager = manager;
    self.manager.visualization.tiles.events.on({
      "batch": self.updateData.bind(self),
      "full-tile": self.updateData.bind(self),
      "all": self.updateData.bind(self)
    });
  },

  initGl: function(gl, cb) {
    var self = this;
    self.gl = gl;
    cb();
  },

  updateData: function () {},

  draw: function () {}
});

Animation.animationClasses = {};
