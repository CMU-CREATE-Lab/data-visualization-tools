var pi_180 = Math.PI / 180.0;
var pi_4 = Math.PI * 4;

function LatLongToPixelXY(latitude, longitude) {
  var sinLatitude = Math.sin(latitude * pi_180);
  var pixelY = (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) /(pi_4)) * 256;
  var pixelX = ((longitude + 180) / 360) * 256;
  var pixel =  { x: pixelX, y: pixelY };

  return pixel;
}

function loadTypedMatrix(arrayBuffer) {
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
  */

  function arrayBuffer2String(buf) {
    return String.fromCharCode.apply(null, new Uint8Array(buf));
  }

  typemap = {
    'Int32': {'size': Int32Array.BYTES_PER_ELEMENT, 'array': Float32Array, 'method': 'getInt32'},
    'Float32': {'size': Float32Array.BYTES_PER_ELEMENT, 'array': Float32Array, 'method': 'getFloat32'},
  }

  var dataView = new DataView(arrayBuffer);

  var headerLen = dataView.getInt32(0, true);
  var result = JSON.parse(arrayBuffer2String(arrayBuffer.slice(4, 4 + headerLen)));

  dataView = new DataView(arrayBuffer, 4 + headerLen);

  var rowLen = result.cols.map(function (col) {
    return typemap[col.type].size;
  }).reduce(
    function (a, b) {
      return a + b;
    },
    0
  );

  var rowCount = dataView.byteLength / rowLen ;
  if (rowCount != result.length) {
    throw "Data size does not match length specified in header: datasize/rowsize=" + rowCount.toString() + " header.length=" + result.length.toString();
  }

  for (var colidx = 0; colidx < result.cols.length; colidx++) {
    var col = result.cols[colidx];
    col.typespec = typemap[col.type];
    col.data = new col.typespec.array(result.length);
  };

  for (var offset = 0, rowidx = 0; offset < dataView.byteLength; rowidx++) {
    for (var colidx = 0; colidx < result.cols.length; colidx++) {
      var col = result.cols[colidx];
      col.data[rowidx] = dataView[col.typespec.method](offset, true);
      offset += col.typespec.size;
    }
  }

  var cols = {};
  for (var colidx = 0; colidx < result.cols.length; colidx++) {
    var col = result.cols[colidx];
    delete col.typespec;
    cols[col.name] = col;
  }
  result.cols = cols;
  return result;
}
