// Web workers for WebGLVectorTile2
// Use with Workers.js

self.importScripts('../../js/earcut.min.js');

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

operations['triangularizeAndJoin'] = function(request) {
  var csv = request.csv;
  var data = csv.table;
  var geojson = request.geojson;
  var nameKey = request.nameKey;
  var first_data_col = csv.first_data_col;
  var epochs = csv.epochs;
  
  var csv_feature_missing_in_geojson = 0;
  var csv_feature_missing_example;
  var csv_feature_found_in_geojson = 0;
  var maxValue = 0;
  var minValue = 1e6; //TODO Is this an ok value?

  var verts = [];
  var t1 = performance.now();

  for (var ii = 1; ii < data.length; ii++) {
    var regionRow = data[ii];
    var name = regionRow[0];
    var feature = geojson.features[geojson.hash[name]];

    if (typeof feature == "undefined") {
      csv_feature_missing_example = name;
      csv_feature_missing_in_geojson++;
    }
    else if (!feature.hasOwnProperty("geometry")) {
      csv_feature_missing_example = name;
      csv_feature_missing_in_geojson++;
    } else {
      csv_feature_found_in_geojson++;
      var idx = [];
      for (var j = first_data_col; j < regionRow.length; j++) {
        if (!isNaN(regionRow[j])) {
          idx.push(j);
        }
      }
      for (var j = 0; j < idx.length; j++) {
        var id_current = idx[j];
        var id_next = idx[j+1];
        if (j == idx.length - 1) {
          id_next = id_current;
        }
	
        var epoch_1 = epochs[id_current - first_data_col];
        var val_1 = regionRow[id_current];
        if (val_1 > maxValue) {
          maxValue = val_1;
        }
        if (val_1 < minValue) {
          minValue = val_1;
        }
        var epoch_2 = epochs[id_next - first_data_col];
        if (j == idx.length - 1) {
          epoch_2 = epochs[id_current - first_data_col] + (epochs[id_current - first_data_col] - epochs[id_current - 1 - first_data_col]);
        }
	
        var val_2 = regionRow[id_next];
        if (val_2 > maxValue) {
          maxValue = val_2;
        }
        if (val_2 < minValue) {
          minValue = val_2;
        }

	if (epoch_1 === undefined || epoch_2 === undefined) continue;
	
        if (feature.geometry.type != "MultiPolygon") {
          var mydata = earcut.flatten(feature.geometry.coordinates);
          var triangles = earcut(mydata.vertices, mydata.holes, mydata.dimensions);
          for (var i = 0; i < triangles.length; i++) {
            var pixel = LatLongToPixelXY(mydata.vertices[triangles[i]*2 + 1],mydata.vertices[triangles[i]*2]);
            verts.push(pixel.x, pixel.y, epoch_1, val_1, epoch_2, val_2);
          }
        } else {
          for ( var jj = 0; jj < feature.geometry.coordinates.length; jj++) {
            var mydata = earcut.flatten(feature.geometry.coordinates[jj]);
            var triangles = earcut(mydata.vertices, mydata.holes, mydata.dimensions);
            for (var i = 0; i < triangles.length; i++) {
              var pixel = LatLongToPixelXY(mydata.vertices[triangles[i]*2 + 1],mydata.vertices[triangles[i]*2]);
              verts.push(pixel.x, pixel.y, epoch_1, val_1, epoch_2, val_2);
            }
          }
        }
      }
    }
  }

  console.log('choroplethworker: joining CSV with geojson (len=' + geojson.features.length + ') found',
	      csv_feature_found_in_geojson, 'of', csv_feature_found_in_geojson+csv_feature_missing_in_geojson, 'CSV records in geojson');
  if (csv_feature_missing_in_geojson) {
    console.log('choroplethworker: example CSV record not found in geojson: name="'+ csv_feature_missing_example + '"');
    if (nameKey) {
      var exampleKey = null;
      console.log('choroplethworker: using custom layer key "' + nameKey + '"');
      var hasKey = 0;
      for (var i = 0; i < geojson.features.length; i++) {
        if (nameKey in geojson.features[i].properties) hasKey++;
	exampleKey = geojson.features[i].properties[nameKey];
      }
      console.log('choroplethworker: ' + hasKey + ' of ' + geojson.features.length + ' has expected key');
      if (exampleKey) {
	console.log('choroplethworker: example key value ' + exampleKey);
      }
    }
  }
  var t2 = performance.now();
  console.log("choroplethworker: Total time in worker: " + (t2 - t1) + "ms");

  return {
    verts: new Float64Array(verts),
    minValue: minValue,
    maxValue: maxValue
  };
};


// TODO: can we have this just defined once?
function LatLongToPixelXY(latitude, longitude) {
  var pi_180 = Math.PI / 180.0;
  var pi_4 = Math.PI * 4;
  var sinLatitude = Math.sin(latitude * pi_180);
  var pixelY = (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (pi_4)) * 256;
  var pixelX = ((longitude + 180) / 360) * 256;
  var pixel = { x: pixelX, y: pixelY };
  return pixel;
}
