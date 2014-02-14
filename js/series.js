function drawPoints(gl, transform, series, from, to, settings) {
  gl.useProgram(series.program);
  gl.vertexAttrib1f(gl.getAttribLocation(series.program, "aPointSize"), settings.pointSize);

  // attach matrix value to 'mapMatrix' uniform in shader
  gl.uniformMatrix4fv(gl.getUniformLocation(series.program, 'mapMatrix'), false, transform);

  // set color for shader
  gl.uniform4fv(gl.getUniformLocation(series.program, 'color'), settings.color);

  // set hardFraction
  // TODO(rsargent): make sure hardFraction is at least 1 pixel less than 100% for antialiasing
  gl.uniform1f(gl.getUniformLocation(series.program, 'hardFraction'), settings.hardFraction);

  // draw!
  gl.drawArrays(gl.POINTS, from, to);
}

// Converts from latlng to xy, and create WebGL buffer
function prepareSeries(gl, series, settings) {
  // Reuse latlng array for x, y
  series.xy = series.latlng;
  for (var i = 0; i < series.latlng.length; i += 2) {
      var lat = series.latlng[i];
      var lon = series.latlng[i + 1];
      var pixel = LatLongToPixelXY(lat, lon);
      series.xy[i] = pixel.x;
      series.xy[i + 1] = pixel.y;
  }
  delete series.latlng;
  series.glBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, series.glBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, series.xy, gl.STATIC_DRAW);

  // create vertex shader
  var vertexSrc = document.getElementById('pointVertexShader').text;
  var vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, vertexSrc);
  gl.compileShader(vertexShader);

  // create fragment shader
  var fragmentSrc = document.getElementById('pointFragmentShader').text;
  var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, fragmentSrc);
  gl.compileShader(fragmentShader);

  // link shaders to create our program
  series.program = gl.createProgram();
  gl.attachShader(series.program, vertexShader);
  gl.attachShader(series.program, fragmentShader);
  gl.linkProgram(series.program);

  // enable the 'worldCoord' attribute in the shader to receive buffer
  gl.enableVertexAttribArray(gl.getAttribLocation(series.program, 'worldCoord'));

  // tell webgl how buffer is laid out (pairs of x,y coords)
  gl.vertexAttribPointer(gl.getAttribLocation(series.program, 'worldCoord'), 2, gl.FLOAT, false, 0, 0);
}

function findIndex(index, series) {
  if (index > series.index[series.index.length - 1]) {
    return series.index.length;
  }
  // Use binary search to find index in array
  var min = 0;
  var max = series.index.length - 1;
  var test = 0;
  while (min < max) {
    test = Math.floor(0.5 * (min + max));
    if (index < series.index[test]) {
      max = test - 1;
    } else if (index > series.index[test]) {
      min = test + 1;
    } else {
      break;
    }
  }
  // If found, return index
  // If failed to find, return "closest" (last index tried)
  return test;
}
