//Legend.js
var Legend = function Legend(id, str) {
    this.id = id;
    this.str = str;
}

Legend.prototype.toString = function legendToString() {
  var ret = '<tr id="' + this.id +'-legend" style="display: none"><td>'+ this.str +'</td></tr>';
  return ret;
}

