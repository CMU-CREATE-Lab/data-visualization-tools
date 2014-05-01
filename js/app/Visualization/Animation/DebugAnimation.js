define(["require", "app/Class", "app/Visualization/GeoProjection", "app/Visualization/Shader", "app/Visualization/Animation/Animation"], function(require, Class, GeoProjection, Shader, Animation) {
  var DebugAnimation = Class(Animation, {
    name: "DebugAnimation",

    initGl: function(gl, cb) {
      var self = this;
      self.gl = gl;
      Shader.createShaderProgramFromUrl(
        self.gl,
        require.toUrl("app/Visualization/Animation/DebugAnimation-vertex.glsl"),
        require.toUrl("app/Visualization/Animation/DebugAnimation-fragment.glsl"),
        function (program) {
          self.program = program;

          self.pointArrayBuffer = self.gl.createBuffer();

          cb();
        }
      );
    },

    updateData: function() {
      var self = this;
      var format = self.manager.visualization.data.format;
      var header = format.header;
      var data = format.data;
      self.pointcount = header.length;

      self.rawLatLonData = new Float32Array(self.pointcount*2);

      for (var rowidx = 0; rowidx < self.pointcount; rowidx++) {
        var pixel = GeoProjection.LatLongToPixelXY(data.latitude[rowidx], data.longitude[rowidx]);
        self.rawLatLonData[2*rowidx] = pixel.x;
        self.rawLatLonData[2*rowidx+1] = pixel.y;
      }

      self.gl.useProgram(self.program);
      Shader.programLoadArray(self.gl, self.pointArrayBuffer, self.rawLatLonData, self.program);

      Animation.prototype.updateData.call(self);
    },

    draw: function () {
      var self = this;

      self.gl.useProgram(self.program);

      Shader.programBindArray(self.gl, self.pointArrayBuffer, self.program, "worldCoord", 2, self.gl.FLOAT);
      self.gl.uniformMatrix4fv(self.program.uniforms.mapMatrix, false, self.manager.mapMatrix);

      self.gl.drawArrays(self.gl.POINTS, 0, self.pointcount);

      Animation.prototype.draw.call(self);
    }
  });
  Animation.animationClasses.debug = DebugAnimation;

  return DebugAnimation;
});
