// Thin layer of boilerplate and helpful utilities for WebGL

export interface GlbWebGLProgram extends WebGLProgram {
  setVertexAttrib: {
    [name: string]: (size: number, type: number, normalized: boolean, stride: number, offset: number) => void
  };
  [attribOrUniform: string]: any;
};

// By default, fragment shader "float" for iOS is 16 bit, but we often need 32 bits.
// Request fragment shader "float" be highp for platforms that support

var gl_fragment_shader_source_prefix = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
#else
  precision mediump float;
#endif
`;


export class Glb {
  gl: WebGLRenderingContext;
  _shaderCache: {[source: string]: WebGLShader} = {};
  _programCache: {[vertexSource: string]: {[fragmentSource: string]: GlbWebGLProgram}} = {};
  static fixedSizePointVertexShader: string;
  static solidColorFragmentShader: string;
  static vectorTileVertexShader: string;
  static vectorTileFragmentShader: string;
  constructor(gl: WebGLRenderingContext) {
    this.gl = gl;
  }
  // Return compiled shader for type and source.
  // If same type and source has already been compiled, return
  //
  // type should be gl.VERTEX_SHADER or gl.FRAGMENT_SHADER
  _shaderFromSource(type: any, source: string): WebGLShader {
    console.assert(type == this.gl.VERTEX_SHADER || type == this.gl.FRAGMENT_SHADER);
    var cache = this._shaderCache[source];
    if (!cache) {
      cache = this._shaderCache[source] = {};
    }
    var shader = cache[type];
    if (!shader) {
      shader = cache[type] = this.gl.createShader(type);
      if (type == this.gl.FRAGMENT_SHADER) {
        source = gl_fragment_shader_source_prefix + source;
        console.log('compiling ', source);
      }
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
  programFromSources(vertexSource: string, fragmentSource: string) {
    var cache = this._programCache[vertexSource];
    if (!cache) {
      cache = this._programCache[vertexSource] = {};
    }
    var program = cache[fragmentSource];
    if (!program) {
      //console.log('Creating shader program');
      program = cache[fragmentSource] = (this.gl.createProgram() as GlbWebGLProgram);
      this.gl.attachShader(program,
        this._shaderFromSource(this.gl.VERTEX_SHADER, vertexSource));
      this.gl.attachShader(program,
        this._shaderFromSource(this.gl.FRAGMENT_SHADER, fragmentSource));
      this.gl.linkProgram(program);
      if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
        throw new Error('Linking shader program, ' + this.gl.getProgramInfoLog(program));
      }
      this._addAttribsAndUniformsToProgram(program);
    }

    return program;
  }

  _addAttribsAndUniformsToProgram(program: GlbWebGLProgram): void {
    var gl = this.gl;

    function enableAttribArray(size: number, type: number, normalized: boolean, stride: number, offset: number) {
      gl.enableVertexAttribArray(this);
      gl.vertexAttribPointer(this, size, type, normalized, stride, offset);
    }

    if (this.gl.getProgramParameter(program, this.gl.ACTIVE_ATTRIBUTES) == 0) {
      throw new Error('Program has no active attributes');
    }
    program.setVertexAttrib = {};
    for (var i = this.gl.getProgramParameter(program, this.gl.ACTIVE_ATTRIBUTES) - 1; i >= 0; i--) {
      var name = this.gl.getActiveAttrib(program, i).name;
      var loc = this.gl.getAttribLocation(program, name);
      program[name] = loc;
      program.setVertexAttrib[name] = enableAttribArray.bind(loc);
    }

    for (var i = this.gl.getProgramParameter(program, this.gl.ACTIVE_UNIFORMS) - 1; i >= 0; i--) {
      var name = this.gl.getActiveUniform(program, i).name;
      program[name] = this.gl.getUniformLocation(program, name);
    }
  }
  createTexture(filter: number, data: HTMLCanvasElement | ArrayBufferView | ImageBitmap | ImageData | HTMLImageElement | HTMLVideoElement | OffscreenCanvas, width: number, height: number) {
    var gl = this.gl;
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    if (data instanceof Uint8Array) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    }
    else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data as TexImageSource);
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
  }
  bindTexture(texture: WebGLTexture, unit: number) {
    var gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
  }
  bindFramebuffer(framebuffer: WebGLFramebuffer, texture: WebGLTexture) {
    var gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    if (texture) {
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    }
  }
  bindAttribute(buffer: WebGLBuffer, attribute: number, numComponents: number) {
    var gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute, numComponents, gl.FLOAT, false, 0, 0);
  }
  createBuffer(array: number) {
    var buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, array, this.gl.STATIC_DRAW);
    return buffer;
  }
}

Glb.fixedSizePointVertexShader = `
attribute vec4 aWorldCoord;
uniform mat4 uTransform;

void main() {
  gl_Position = uTransform * aWorldCoord;
  gl_PointSize = 50.0;
}`;

Glb.solidColorFragmentShader = `
void main() {
  gl_FragColor = vec4(1.0, 0.25, 0.25, 1.0);
}`;

Glb.vectorTileVertexShader = `
attribute vec4 worldCoord;
attribute float time;

uniform mat4 mapMatrix;
uniform float maxTime;
uniform float minTime;

void main() {
  if (time < minTime || time > maxTime) {
    gl_Position = vec4(-1,-1,-1,-1);
  } else {
    gl_Position = mapMatrix * worldCoord;
  }
}`;

Glb.vectorTileFragmentShader = `
void main() {
  gl_FragColor = vec4(.0, 1., .15, 1.0);
}`;

// Export globally for timelapse
(window as any).Glb = Glb;