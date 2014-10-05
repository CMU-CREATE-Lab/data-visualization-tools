"use strict";

function WebglVideoTile(glb, tileidx, bounds, url) {
  this._tileidx = tileidx;
  this.glb = glb;
  this.gl = glb.gl;
  this._lineProgram = glb.programFromSources(Glb.fixedSizePointVertexShader,
                                             Glb.solidColorFragmentShader);
  this._textureProgram = glb.programFromSources(WebglVideoTile.textureVertexShader,
                                                WebglVideoTile.textureFragmentShader);
                                                
  this._readyAfter = performance.now() + Math.random() * 1000;
  var inset = (bounds.max.x - bounds.min.x) * 0.005;
  this._insetRectangle = glb.createBuffer(new Float32Array([0.01, 0.01,
                                                            0.99, 0.01, 
                                                            0.99, 0.99, 
                                                            0.01, 0.99]));
  this._triangles = glb.createBuffer(new Float32Array([0, 0,
                                                       1, 0,
                                                       0, 1,
                                                       1, 1]));

  this._video = $('<video>').attr('src', url)[0];
  this._currentTexture = this.gl.createTexture(),
  this._nextTexture = this.gl.createTexture(),
  this._frameGrabbed = false;
  this._width = 1424;
  this._height = 800;
  this._bounds = bounds;
}

WebglVideoTile.prototype.
toString = function() {
  return 'Tile ' + this._tileidx.toString() + ', ready: ' + this.isReady();
};

WebglVideoTile.prototype.
isReady = function() {
  return this._video.readyState == 4;
};

WebglVideoTile.prototype.
updateFrame = function() {
  if (!this._frameGrabbed && this._video.readyState == 4) {
    this._frameGrabbed = true;
    var gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this._currentTexture);
    var before = performance.now();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, this._video);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    var elapsed = performance.now() - before;
  }
}

WebglVideoTile.prototype.
draw = function(transform) {
  var gl = this.gl;
  var tileTransform = new Float32Array(transform);
  translateMatrix(tileTransform, this._bounds.min.x, this._bounds.min.y);
  scaleMatrix(tileTransform, 
              this._bounds.max.x - this._bounds.min.x,
              this._bounds.max.y - this._bounds.min.y);
              
  this.updateFrame();

  // Draw rectangle
  gl.useProgram(this._lineProgram);
  gl.uniformMatrix4fv(this._lineProgram.uTransform, false, tileTransform);
  gl.bindBuffer(gl.ARRAY_BUFFER, this._insetRectangle);
  gl.vertexAttribPointer(this._lineProgram.aWorldCoord, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(this._lineProgram.aWorldCoord);
  gl.drawArrays(gl.LINE_LOOP, 0, 4);

  // Draw video
  if (this._frameGrabbed) {
    gl.useProgram(this._textureProgram);
    gl.uniformMatrix4fv(this._textureProgram.uTransform, false, tileTransform);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._triangles);
    gl.vertexAttribPointer(this._textureProgram.aTextureCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this._lineProgram.aTextureCoord);

    gl.bindTexture(gl.TEXTURE_2D, this._currentTexture);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
};

WebglVideoTile.textureVertexShader =
  'attribute vec2 aTextureCoord;\n' +
  'uniform mat4 uTransform;\n' +
  'varying vec2 vTextureCoord;\n' +

  'void main(void) {\n' +
  '  vTextureCoord = vec2(aTextureCoord.x, aTextureCoord.y);\n' +
  '  gl_Position = uTransform * vec4(aTextureCoord.x, aTextureCoord.y, 0., 1.);\n' +
//  '  gl_Position = vec4(aTextureCoord.x, aTextureCoord.y, 0, 1);\n' +
  '}\n';


WebglVideoTile.textureFragmentShader = 
  'precision mediump float;\n' +
  'varying vec2 vTextureCoord;\n' +
  'uniform sampler2D uSampler;\n' +
  'void main(void) {\n' +
  '  vec4 textureColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));\n' +
  '  gl_FragColor = vec4(textureColor.rgb, 1);\n' +
  '}\n';
