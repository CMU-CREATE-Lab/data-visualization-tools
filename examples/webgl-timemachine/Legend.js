//Legend.js
var Legend = function Legend(id, str) {
    this.id = id;
    this.str = str;
}

Legend.prototype.toString = function legendToString() {
  var ret = '<tr id="' + this.id +'-legend" style="display: none"><td>'+ this.str +'</td></tr>';
  return ret;
}

var BubbleMapLegend = function BubbleMapLegend(opts) {
    this.width = 240;
    this.height = 170;
    this.keyY = 10;
    this.keyOffset = 60;.0
    this.id = opts["id"];
    this.str = opts["str"] || this.setStr(opts);
    Legend.call(this, this.id, this.str);
}
BubbleMapLegend.prototype = Object.create(Legend.prototype);

BubbleMapLegend.prototype.setStr = function setStr(opts) {
    var that = this;
    function getKey(color, str) {
        var circle = '<circle class="gain" r="10" cx="15" cy="' + that.keyY + '" style="fill: ' + color + '; stroke: #fff;"></circle>';
        var text = '<text x="30" y="' + (that.keyY + 5.0) + '" style="font-size: 12px; fill: #666">' + str + '</text>';
        return circle + text;
    }

    function getCircle(value, radius) {
        var circle = '<circle r="' + radius + '" cx="120.0" cy=" ' +  (that.height - (that.keyOffset + parseFloat(radius))) + '" vector-effect="non-scaling-stroke" style="fill: none; stroke: #999"></circle>';
        var text =  '<text text-anchor="middle" x="120.0" y="' + (that.height - (that.keyOffset + parseFloat(radius)) - parseFloat(radius)) + '" dy="13" style="font-size: 10px; fill: #666">' + value + '</text>';
        return circle + text;
    }

    var div = '<div style="font-size: 15px">' + opts["title"] + '<span class="credit"> ('+ opts["credit"] +')</span></div>';
    var svg = '<svg class="svg-legend" width="240" height="170">';
    var keys = '';
    for (var i = 0; i < opts["keys"].length; i++) {
        keys += getKey(opts["keys"][i]['color'], opts["keys"][i]['str']);
        this.keyOffset -= 20.0;
        that.keyY += 25.0;;
    }
    var circles = '';
    for (var i = 0; i < opts["circles"].length; i++) {
        circles += getCircle(opts["circles"][i]['value'], opts["circles"][i]['radius']);
    }
    return div + svg + keys + circles + '</svg>';
}

