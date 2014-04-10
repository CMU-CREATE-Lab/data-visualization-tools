define(["Class", "async", "jQuery"], function(Class, async, $) {
  var Shader = {};

  /* Load array data into gl buffers and bind that buffer to a shader
   * program attribute */
  Shader.programLoadArray = function(gl, glbuffer, arraydata, program) {
    gl.bindBuffer(gl.ARRAY_BUFFER, glbuffer);
    gl.bufferData(gl.ARRAY_BUFFER, arraydata, gl.STATIC_DRAW);
  };

  Shader.programBindArray = function(gl, glbuffer, program, attrname, size, type, stride, offset) {
    if (program.attributes[attrname] == undefined) {
      console.warn(["Attempted to set an non-existent attribute " + attrname + ".", program]);
    } else {
      gl.bindBuffer(gl.ARRAY_BUFFER, glbuffer);
      gl.enableVertexAttribArray(program.attributes[attrname]);
      gl.vertexAttribPointer(program.attributes[attrname], size, type, false, stride || 0, offset || 0);
    }
  };

  Shader.createShaderProgram = function(gl, vertexShaderNode, fragmentShaderNode) {
    return Shader.createShaderProgramFromSource(gl, $(vertexShaderNode).text(), $(fragmentShaderNode).text());
  };

  Shader.createShaderProgramFromUrl = function(gl, vertexShaderUrl, fragmentShaderUrl, cb) {
    var vertexSrc;
    var fragmentSrc;
    async.series([
      function (cb) { $.get(vertexShaderUrl, function (data) { vertexSrc = data; cb(); }, "text"); },
      function (cb) { $.get(fragmentShaderUrl, function (data) { fragmentSrc = data; cb(); }, "text"); },
      function (dummy) { cb(Shader.createShaderProgramFromSource(gl, vertexSrc, fragmentSrc)); }
    ]);
  }

  Shader.createShaderProgramFromSource = function(gl, vertexSrc, fragmentSrc) {
    // create vertex shader
    var vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexSrc);
    gl.compileShader(vertexShader);

    // create fragment shader
    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentSrc);
    gl.compileShader(fragmentShader);

    // link shaders to create our program
    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    gl.useProgram(program);

    // Collect attribute locations to make binding easier in the code using this program
    program.attributes = {};
    for (var i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES); i++) {
      name = gl.getActiveAttrib(program, i).name;
      program.attributes[name] = gl.getAttribLocation(program, name);
    }

    program.uniforms = {};
    for (var i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i++) {
      name = gl.getActiveUniform(program, i).name;
      program.uniforms[name] = gl.getUniformLocation(program, name);
    }

    return program;
  };

  return Shader;
});
