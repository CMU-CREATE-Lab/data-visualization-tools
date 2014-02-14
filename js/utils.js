var pi_180 = Math.PI / 180.0;
var pi_4 = Math.PI * 4;

function LatLongToPixelXY(latitude, longitude) {
  var sinLatitude = Math.sin(latitude * pi_180);
  var pixelY = (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) /(pi_4)) * 256;
  var pixelX = ((longitude + 180) / 360) * 256;
  var pixel =  { x: pixelX, y: pixelY };

  return pixel;
}

function circumferenceOfEarthAtLatitude(latitude) {
  return Math.cos(latitude * Math.PI/180).toFixed(8) * 40075017;
}
      
function getMetersPerPixelAtLatitude(latitude, zoom) {
  return circumferenceOfEarthAtLatitude(latitude) / (256 * Math.pow(2,zoom)) ;
}
      
function getPixelDiameterAtLatitude(diameterInMeters, latitude, zoom) {
  return diameterInMeters / getMetersPerPixelAtLatitude(latitude, zoom);
}

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

Date.prototype.yyyymmdd = function() {         
  var yyyy = this.getUTCFullYear().toString();                                    
  var mm = (this.getUTCMonth()+1).toString();
  var dd  = this.getUTCDate().toString();             
  return yyyy + '-' + (mm[1]?mm:"0"+mm[0]) + '-' + (dd[1]?dd:"0"+dd[0]);
};  

Date.prototype.hhmmss = function() {         
  var hh = this.getUTCHours().toString();                                    
  var mm = this.getUTCMinutes().toString();
  var ss  = this.getUTCSeconds().toString();             
  return (hh[1]?hh:"0"+hh[0]) + ':' + (mm[1]?mm:"0"+mm[0]) + ":" + (ss[1]?ss:"0"+ss[0]);
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
        opts.error && opts.error('could not load: ' + url);
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
      for (var colidx = 0; colidx < header.cols.length; colidx++) {
        var col = header.cols[colidx];
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
