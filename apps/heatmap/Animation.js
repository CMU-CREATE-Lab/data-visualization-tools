Animation = Class({
  initialize: function(manager) {
    var self = this;
    self.manager = manager;
  },

  initGl: function(gl, cb) {
    var self = this;
    self.gl = gl;
    cb();
  },

  header: function(header) {},
  row: function(rowidx, data) {},
  batch: function() {},
  draw: function () {}
});

Animation.animationClasses = {};
