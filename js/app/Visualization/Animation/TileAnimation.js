define(["require", "Class", "Visualization/GeoProjection", "Visualization/Shader", "Visualization/Animation/Animation"], function(require, Class, GeoProjection, Shader, Animation) {
  var TileAnimation = Class(Animation, {
    name: "PointAnimation",

    magnitudeScale: 0.1,

    initGl: function(gl, cb) {
      var self = this;
      self.gl = gl;
      Shader.createShaderProgramFromUrl(
        self.gl,
        require.toUrl("Visualization/Animation/TileAnimation-vertex.glsl"),
        require.toUrl("Visualization/Animation/TileAnimation-fragment.glsl"),
        function (program) {
          self.program = program;

          self.pointArrayBuffer = self.gl.createBuffer();

          cb();
        }
      );
    },

    updateData: function() {
      var self = this;
      var tiles = Object.values(self.manager.visualization.data.format.tiles);

      self.rawLatLonData = new Float32Array(tiles.length*5*2);
      self.tilecount = tiles.length;

      var i = 0;
      tiles.map(function (tile) {
        var corners = [
          {lat: tile.bounds.top, lon: tile.bounds.left},
          {lat: tile.bounds.top, lon: tile.bounds.right},
          {lat: tile.bounds.bottom, lon: tile.bounds.right},
          {lat: tile.bounds.bottom, lon: tile.bounds.left},
          {lat: tile.bounds.top, lon: tile.bounds.left}];
        corners.map(function (corner) {
          var pixel = GeoProjection.LatLongToPixelXY(corner.lat, corner.lon);
          self.rawLatLonData[i++] = pixel.x;
          self.rawLatLonData[i++] = pixel.y;
        });
      });

      self.gl.useProgram(self.program);
      Shader.programLoadArray(self.gl, self.pointArrayBuffer, self.rawLatLonData, self.program);
      Animation.prototype.updateData.call(self);
    },

    draw: function () {
      var self = this;

      self.gl.useProgram(self.program);

      Shader.programBindArray(self.gl, self.pointArrayBuffer, self.program, "worldCoord", 2, self.gl.FLOAT);

      self.gl.uniformMatrix4fv(self.program.uniforms.mapMatrix, false, self.manager.mapMatrix);

      for (var i = 0; i < self.tilecount; i++) {
        self.gl.drawArrays(self.gl.LINE_STRIP, i*5, 5);
      }

      Animation.prototype.draw.call(self);
    }
  });
  Animation.animationClasses.tile = TileAnimation;

  return TileAnimation;
});
