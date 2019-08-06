function EarthTimeCsvTable(data) {
  this.parsed = Papa.parse(data, {header: false});
  this.table = this.parsed.data;
  this.header = this.table[0];

  this.first_data_col = 1;
  
  this.has_lat_lon = (this.header[1].substr(0,3).toLowerCase() == 'lat' &&
		      this.header[2].substr(0,3).toLowerCase() == 'lon');
  if (this.has_lat_lon) this.first_data_col += 2;
  
  var potential_packedColor_col = this.first_data_col;
  var has_packedColor = (this.header[potential_packedColor_col] && this.header[potential_packedColor_col].substr(0,11).toLowerCase() == 'packedcolor');
  if (this.has_packedColor) this.first_data_col += 1;

  // Parse epoch times for CSV columns
  this.epochs = [];
  this.epoch2col = {};
  
  for (var i = this.first_data_col; i < this.header.length; i++) {
    var epoch = parseDateStr(this.header[i]);
    if (isNaN(epoch)) break;
    this.epochs.push(epoch);
    this.epoch2col[epoch] = i;
  }
  
  // Extend epochs by one element into the future, for creating additional timestep
  // at the end to cope with fencepost issue
  this.epochs_plus_one = this.epochs.concat([this.epochs[this.epochs.length - 1] +
					     (this.epochs[this.epochs.length - 1] - this.epochs[this.epochs.length - 2])]);

  // Build index to map regionName to CSV row number
  // TODO: deal with BTI with multiple aliases per geometry, mapping to canonical name
  this.region_name_to_row = {};
  for (var i = 1; i < this.table.length; i++) {
    var canonicalRegionName = this.table[i][0];
    this.region_name_to_row[canonicalRegionName] = i;
  }

  this.minValue = undefined;
  this.maxValue = undefined;
  
  // Parse floats
  var allCommas = /,/g
  for (var i = 1; i < this.table.length; i++) {
    var row = this.table[i];
    for (var j = this.first_data_col; j < row.length; j++) {
      var val = row[j] = parseFloat(row[j].replace(allCommas, ''));
      if (!isNaN(val)) {
	if (this.minValue === undefined || val < this.minValue) this.minValue = val;
	if (this.maxValue === undefined || val > this.maxValue) this.maxValue = val;
      }
    }
  }

  this.interpolatedRows = {};
}

// First time to call on a row will construct the interpolated version
EarthTimeCsvTable.prototype.getInterpolatedRow = function(rowNum) {
  if (!this.interpolatedRows[rowNum]) {
    var originalRow = this.table[rowNum];
    var interpolatedRow = originalRow.slice(0); // copy row
    var preValidIndex = undefined;
    for (var i = 0; i < originalRow.length; i++) {
      if (!isNaN(originalRow[i])) {
	if (preValidIndex != i - 1) {
	  // do the interpolation
	  var from = originalRow[preValidIndex], to = originalRow[i];
	  for (var j = preValidIndex + 1; j < i; j++) {
	    var frac = (j - preValidIndex) / (i - preValidIndex);
	    interpolatedRow[j] = from + frac * (to - from);
	  }
	}
	preValidIndex = i;
      }
    }
    this.interpolatedRows[rowNum] = interpolatedRow;
  }
  return this.interpolatedRows[rowNum];
};
