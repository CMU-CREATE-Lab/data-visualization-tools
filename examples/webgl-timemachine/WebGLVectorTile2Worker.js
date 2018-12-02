// WebGLVectorTile2Worker.js
// Use from Workers.js

operations['computeColorDotmapFromBox'] = function(request) {
  var tileData = new Uint8Array(request.tileDataF32.buffer);
  // Iterate through the raster, creating dots on the fly

  var ret = {};
  ret.pointCount = tileData.reduce(function(a,b) { return a+b;})

  if (ret.pointCount > 0) {
    ret.data = new Float32Array(ret.pointCount * 3);
    var input_idx = 0;
    var output_idx = 0;
    var numColors = request.dotmapColors.length;
    var tileDim = 256;
    console.assert(numColors == tileData.length / (tileDim * tileDim));
      
    // Find location of tile
    var projectedTileSize = 256 / 2 ** request.tileidx.l; // 256 for level 0, 128 for level 1 ...
    var projectedXMin = projectedTileSize * request.tileidx.c;
    var projectedYMin = projectedTileSize * request.tileidx.r;
    
    // Loop through the rasters, creating points within each box
    for (var c = 0; c < numColors; c++) {
      for (var y = 0; y < tileDim; y++) {
	for (var x = 0; x < tileDim; x++) {
	  for (var p = 0; p < tileData[input_idx]; p++) {
	    ret.data[output_idx * 3 + 0] = projectedXMin + (x + Math.random()) * projectedTileSize / 256;
	    ret.data[output_idx * 3 + 1] = projectedYMin + (y + Math.random()) * projectedTileSize / 256;
	    ret.data[output_idx * 3 + 2] = request.dotmapColors[c];
	    output_idx++;
	  }
	  input_idx++;
	}
      }
    }
    console.assert(input_idx == tileData.length);
    console.assert(output_idx == ret.data.length / 3);
    
    // Randomly permute the order of points
    for (var i = ret.pointCount - 1; i >= 1; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp;
      tmp = ret.data[i * 3 + 0]; ret.data[i * 3 + 0] = ret.data[j * 3 + 0]; ret.data[j * 3 + 0] = tmp;
      tmp = ret.data[i * 3 + 1]; ret.data[i * 3 + 1] = ret.data[j * 3 + 1]; ret.data[j * 3 + 1] = tmp;
      tmp = ret.data[i * 3 + 2]; ret.data[i * 3 + 2] = ret.data[j * 3 + 2]; ret.data[j * 3 + 2] = tmp;
    }
  }

  return ret;
}

