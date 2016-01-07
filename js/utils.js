/* Async mechanism to wait for a condition to be true.
   Callbacks can wait to be executed once the condition is set to true.
   Once the condition is set it will always remain set, and any
   callbacks set to wait for it will be executed immediately.
*/
function Condition() {
  this.is_true = false;
  this.waiting = [];
}
Condition.prototype.set = function (cb) {
  this.is_true = true;
  async.series(this.waiting, cb);
}
Condition.prototype.wait = function (cb) {
  if (this.is_true) {
    cb(function () {});
  } else {
    this.waiting.push(cb);
  }
}

// Use google maps Mercator projection to convert from lat, lng to
// x, y coords in the range x:0-256, y:0-256
function LatLongToPixelXY(latitude, longitude) {
  var x = (longitude + 180) * 256 / 360;
  var y = 128 - Math.log(Math.tan((latitude + 90) * Math.PI / 360)) * 128 / Math.PI;
  return {x: x, y: y};
}

function PixelXYToLatLong(xy) {
  var lat = Math.atan(Math.exp((128 - xy.y) * Math.PI / 128)) * 360 / Math.PI - 90;
  var lng = xy.x * 360 / 256 - 180;
  return {lat: lat, lng: lng};
};

function circumferenceOfEarthAtLatitude(latitude) {
  return Math.cos(latitude * Math.PI/180).toFixed(8) * 40075017;
}
      
function getMetersPerPixelAtLatitude(latitude, zoom) {
  return circumferenceOfEarthAtLatitude(latitude) / (256 * Math.pow(2,zoom)) ;
}
      
function getPixelDiameterAtLatitude(diameterInMeters, latitude, zoom) {
  return diameterInMeters / getMetersPerPixelAtLatitude(latitude, zoom);
}

// WebGL matrix utils for 2D
function scaleMatrix(matrix, scaleX, scaleY) {
  // scaling x and y, which is just scaling first two columns of matrix
  matrix[0] *= scaleX;
  matrix[1] *= scaleX;
  matrix[2] *= scaleX;
  matrix[3] *= scaleX;

  matrix[4] *= scaleY;
  matrix[5] *= scaleY;
  matrix[6] *= scaleY;
  matrix[7] *= scaleY;
}

function translateMatrix(matrix, tx, ty) {
  // translation is in last column of matrix
  matrix[12] += matrix[0]*tx + matrix[4]*ty;
  matrix[13] += matrix[1]*tx + matrix[5]*ty;
  matrix[14] += matrix[2]*tx + matrix[6]*ty;
  matrix[15] += matrix[3]*tx + matrix[7]*ty;
}

function transformM4V2(m, v) {
  return {x: m[0] * v.x + m[4] * v.y + m[12],
          y: m[1] * v.x + m[5] * v.y + m[13]};
}

// from gl-matrix, (c) Brandon Jones, Colin MacKenzie IV, license http://bit.ly/1oEcfOW
function invert4(out, a) {
  var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
  a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
  a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
  a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15],

  b00 = a00 * a11 - a01 * a10,
  b01 = a00 * a12 - a02 * a10,
  b02 = a00 * a13 - a03 * a10,
  b03 = a01 * a12 - a02 * a11,
  b04 = a01 * a13 - a03 * a11,
  b05 = a02 * a13 - a03 * a12,
  b06 = a20 * a31 - a21 * a30,
  b07 = a20 * a32 - a22 * a30,
  b08 = a20 * a33 - a23 * a30,
  b09 = a21 * a32 - a22 * a31,
  b10 = a21 * a33 - a23 * a31,
  b11 = a22 * a33 - a23 * a32,

  det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

  if (!det) { 
    return null; 
  }
  det = 1.0 / det;

  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

  return out;
};


Date.prototype.yyyymmdd = function(stepsize) {
  if (stepsize == undefined) stepsize = -1;
  
  var yyyy = this.getUTCFullYear().toString();                                    
  var mm = (this.getUTCMonth()+1).toString();
  var dd  = this.getUTCDate().toString();             
  var res = yyyy;
  if (stepsize < 365*24*60*60) res += '-' + (mm[1]?mm:"0"+mm[0]) + '-' + (dd[1]?dd:"0"+dd[0]);
  return res;
};  

Date.prototype.hhmmss = function(stepsize) {
  if (stepsize == undefined) stepsize = -1;

  var hh = this.getUTCHours().toString();                                    
  var mm = this.getUTCMinutes().toString();
  var ss  = this.getUTCSeconds().toString();
  var res = hh[1]?hh:"0"+hh[0];
  if (stepsize < 60*60) res += ':' + (mm[1]?mm:"0"+mm[0]);
  if (stepsize < 60) res += ':' + (ss[1]?ss:"0"+ss[0]);
  return res;
}; 

Date.prototype.rfcstring = function(sep, stepsize) {
  if (sep == undefined) sep = "T";
  if (stepsize == undefined) stepsize = -1;

  var res = '';
  res = this.yyyymmdd(stepsize);
  if (stepsize < 24*60*60) res += sep + this.hhmmss(stepsize);
  if (stepsize < 1) res += (this.getUTCMilliseconds() / 1000).toString().substr(1);
  return res;
};

function loadTypedMatrix(opts) {
  /* Loads a matrix of rows/cols of typed data from a binary file.
     The data format is (all values little endian):

     [4 byte header length in bytes]
     [header data]
     [row]
     [row]
     ...

     The header is json encoded and should contain at the very least

     {length: NUMBER_OF_ROWS, cols: [COL,...]}

     COL should contain {name: NAME, type: TYPE}

     where NAME is any string and TYPE is one of the type names found
     in typemap below.

     Each row consists of data encoded as per the column
     specifications (in that same order). The byte length of each
     column is defined by its type.

     Parameters:
     {
       header: function (header) {},
       row: function (row) {},
       batch: function () {},
       done: function () {},
       error: function (exception) {},
     }

     where done is a boolean. Note that this callback is called
     multiple times first for the header (row is null), and then
     once for each row, and finally with done set to true to signal
     the end of the data.

     Implementation details/explanation for this ugly code:

     moz-chunked-arraybuffer is only supported in firefox... So I
     reverted to the old-school overrideMimeType and loading the file
     is binary "text", and converting it to ArrayBuffer by hand for
     decoding.
  */

  typemap = {
    'Int32': {'size': Int32Array.BYTES_PER_ELEMENT, 'array': Float32Array, 'method': 'getInt32'},
    'Float32': {'size': Float32Array.BYTES_PER_ELEMENT, 'array': Float32Array, 'method': 'getFloat32'},
  }

  var header = null;
  var headerLen = null;
  var offset = 0;
  var rowidx = 0;
  var rowLen = null;
  var request = null;
  var responseData = null;

  if (window.XMLHttpRequest) {
    request = new XMLHttpRequest();
  } else {
    throw 'XMLHttpRequest is disabled';
  }
/*
  if (request.responseType === undefined) {
    throw 'no support for binary files';
  }
*/

  function writeStringToArrayBuffer(str, start, end, buf, bufstart) {
    if (end == undefined) end = str.length;
    if (start == undefined) start = 0;
    if (bufstart == undefined) bufstart = start;
    for (var i = start; i < end; i++) buf[i - start + bufstart] = str.charCodeAt(i) & 0xff;
  }

  function stringToArrayBuffer(str, start, end) {
    if (end == undefined) end = str.length;
    if (start == undefined) start = 0;
    var res = new Uint8ClampedArray(end - start);
    writeStringToArrayBuffer(str, start, end, res, 0);
    return res.buffer;
  }

  function arrayBuffer2String(buf) {
    return String.fromCharCode.apply(null, new Uint8Array(buf));
  }


  var handleData = function () {
    if (!request) return;

    if (request.readyState == 4) {
      /* HTTP reports success with a 200 status. The file protocol
         reports success with zero. HTTP does not use zero as a status
         code (they start at 100).
         https://developer.mozilla.org/En/Using_XMLHttpRequest */
      if (request.status != 200 && request.status != 0) {
        opts.error && opts.error('could not load: ' + opts.url);
        return true;
      }
    }

    if (!request.responseText) return;

    var length = request.responseText.length;
    var text = request.responseText;

    if (length < 4) return;
    if (headerLen == null) {
      headerLen = new DataView(stringToArrayBuffer(text, 0, 4)).getInt32(0, true);
      offset = 4;
    }
    if (length < offset + headerLen) return;
    if (header == null) {
      header = JSON.parse(text.substr(offset, headerLen));

      rowLen = 0;
      header.colsByName = {};
      for (var colidx = 0; colidx < header.cols.length; colidx++) {
        var col = header.cols[colidx];
        col.idx = colidx;
        header.colsByName[col.name] = col;
        col.typespec = typemap[col.type];
        rowLen += col.typespec.size;
      };

      offset = 4 + headerLen;
      opts.header && opts.header(header);
    }
    if (responseData == null) {
      // Yes, I'm lazy and allocate space for the header to, but we
      // never write it, just to not have to bother about two offsets
      responseData = new Uint8ClampedArray(offset + (rowLen * header.length));
    }
    writeStringToArrayBuffer(text, offset, undefined, responseData);

    var dataView = new DataView(responseData.buffer);

    for (; offset + rowLen <= length; rowidx++) {
      var row = {};
      for (var colidx = 0; colidx < header.cols.length; colidx++) {
        var col = header.cols[colidx];
        row[col.name] = dataView[col.typespec.method](offset, true);
        offset += col.typespec.size;
      }
      opts.row && opts.row(row);
    }
    opts.batch && opts.batch();
    if (rowidx == header.length) {
      opts.done && opts.done();
      return true;
    }
  };

  request.open('GET', opts.url, true);
  request.overrideMimeType('text\/plain; charset=x-user-defined');
  request.send(null);
  var handleDataCallback = function () {
    if (!handleData()) {
      setTimeout(handleDataCallback, 500);
    }
  }
  setTimeout(handleDataCallback, 500);
}

/* These two functions uses the location hash to store "bookmarkable"
 * data, using the same format as an URL query.
 *
 * Examples:
 * http://example.com/index.html#name=value&someothername=foo%20bar
 */

function getParameter(name) {
  name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
  var regex = new RegExp("[#&]" + name + "=([^&]*)"),
  results = regex.exec(location.hash);
  return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function setParameter(name, value) {
  var rname = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
  var regex = new RegExp("[#&]" + rname + "=([^&]*)");
  var replacement = "";
  if (value != null && value != undefined) {
    replacement = "&" + name + "=" + encodeURIComponent(value);
  }
  if (regex.exec(location.hash) == null) {
    location.hash = "#" + (location.hash + replacement).substr(1);    
  } else {
    results = location.hash.replace(regex, replacement);
    location.hash = "#" + results.substr(1);
  }
}

/* Load array data into gl buffers and bind that buffer to a shader
 * program attribute */
function programLoadArray(gl, glbuffer, arraydata, program) {
  gl.bindBuffer(gl.ARRAY_BUFFER, glbuffer);
  gl.bufferData(gl.ARRAY_BUFFER, arraydata, gl.STATIC_DRAW);
}

function programBindArray(gl, glbuffer, program, attrname, size, type, stride, offset) {
  if (program.attributes[attrname] == undefined) {
    console.warn(["Attempted to set an non-existent attribute " + attrname + ".", program]);
  } else {
    gl.bindBuffer(gl.ARRAY_BUFFER, glbuffer);
    gl.enableVertexAttribArray(program.attributes[attrname]);
    gl.vertexAttribPointer(program.attributes[attrname], size, type, false, stride || 0, offset || 0);
  }
}

function createShaderProgram(gl, vertexShaderNode, fragmentShaderNode) {
  return createShaderProgramFromSource(gl, $(vertexShaderNode).text(), $(fragmentShaderNode).text());
}

function createShaderProgramFromUrl(gl, vertexShaderUrl, fragmentShaderUrl, cb) {
  var vertexSrc;
  var fragmentSrc;
  async.series([
    function (cb) { $.get(vertexShaderUrl, function (data) { vertexSrc = data; cb(); }, "text"); },
    function (cb) { $.get(fragmentShaderUrl, function (data) { fragmentSrc = data; cb(); }, "text"); },
    function (dummy) { cb(createShaderProgramFromSource(gl, vertexSrc, fragmentSrc)); }
  ]);
}

function createShaderProgramFromSource(gl, vertexSrc, fragmentSrc) {
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
}

// Convert relative url to an absolute one
function relUrlToAbsUrl(url) {
  var div = document.createElement('div');
  div.innerHTML = "<a></a>";
  div.firstChild.href = url; // Ensures that the href is properly escaped
  div.innerHTML = div.innerHTML; // Run the current innerHTML back through the parser
  return div.firstChild.href;
}
