function Animation () {
}
Animation.prototype.init = function(visualization) {
  var animation = this;
  animation.visualization = visualization;
}
Animation.prototype.initGl = function(gl, cb) {
  var animation = this;
  animation.gl = gl;
  cb();
}
Animation.prototype.header = function(header) {}
Animation.prototype.row = function(rowidx, data) {}
Animation.prototype.batch = function() {}
Animation.prototype.draw = function () {}

Animation.animationClasses = {};
