// A (hopefully) very thin layer of boilerplate and helpful utilities for WebGL

function Glb(gl) {
  this.gl = gl;
  this._shaderCache = {};
  this._programCache = {};
};

// Return compiled shader for type and source.
// If same type and source has already been compiled, return
//
// type should be gl.VERTEX_SHADER or gl.FRAGMENT_SHADER
Glb.prototype.
_shaderFromSource = function(type, source) {
  var cache = this._shaderCache[source];
  if (!cache) {
    cache = this._shaderCache[source] = {};
  }
  var shader = cache[type];
  if (!shader) {
    shader = cache[type] = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      throw new Error('Compiling shader, ' + this.gl.getShaderInfoLog(shader));
    }
  }
  return shader;
}

// Return compiled and linked program for vertex and fragment shader sources.
// If identical program has already been compiled and linked, return it.
Glb.prototype.
programFromSources = function(vertexSource, fragmentSource) {
  var cache = this._programCache[vertexSource];
  if (!cache) {
    cache = this._programCache[vertexSource] = {};
  }
  var program = cache[fragmentSource];
  if (!program) {
    console.log('Creating shader program');
    program = cache[fragmentSource] = this.gl.createProgram();
    this.gl.attachShader(program, 
                         this._shaderFromSource(this.gl.VERTEX_SHADER, vertexSource));
    this.gl.attachShader(program, 
                         this._shaderFromSource(this.gl.FRAGMENT_SHADER, fragmentSource));
    this.gl.linkProgram(program);
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      throw new Error('Linking shader program, ' + this.gl.getProgramInfoLog(program));
    }
  }

  this._addAttribsAndUniformsToProgram(program);

  return program;
}

Glb.prototype.
_addAttribsAndUniformsToProgram = function(program) {
  if (this.gl.getProgramParameter(program, this.gl.ACTIVE_ATTRIBUTES) == 0) {
    throw new Error('Program has no active attributes');
  }
  for (var i = this.gl.getProgramParameter(program, this.gl.ACTIVE_ATTRIBUTES) - 1; 
       i >= 0;
       i--) {
    var name = this.gl.getActiveAttrib(program, i).name;
    program[name] = this.gl.getAttribLocation(program, name);
  }

  for (var i = this.gl.getProgramParameter(program, this.gl.ACTIVE_UNIFORMS) - 1; 
       i >= 0;
       i--) {
    var name = this.gl.getActiveUniform(program, i).name;
    program[name] = this.gl.getUniformLocation(program, name);
  }
}

Glb.prototype.
createBuffer = function(array) {
  var buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, array, gl.STATIC_DRAW);
  return buffer;
}

Glb.fixedSizePointVertexShader =
'attribute vec4 aWorldCoord;\n' +
'uniform mat4 uTransform;\n' +

'void main() {\n' +
'  gl_Position = uTransform * aWorldCoord;\n' +
'  gl_PointSize = 50.0;\n' +
'}\n';

Glb.solidColorFragmentShader =
'void main() {\n' +
'  gl_FragColor = vec4(1.0, 0.25, 0.25, 1.0);\n' +
'}';

