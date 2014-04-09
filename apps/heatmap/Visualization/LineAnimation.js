define(["Class", "Visualization/Animation", "Visualization/PointAnimation"], function(Class, Animation, PointAnimation) {
  var LineAnimation = Class(PointAnimation, {
    getDrawMode: function () {
      var self = this;

      self.gl.uniform1i(self.program.uniforms.doShade, 0);
      return self.gl.LINE_STRIP;
    }
  });
  Animation.animationClasses.line = LineAnimation;

  return LineAnimation;
});

