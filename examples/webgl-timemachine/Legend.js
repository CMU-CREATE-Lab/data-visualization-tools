//Legend.js

"use strict";

// Template literals (strings) are not supported in IE 11 (and other browsers that don't support ES6)
// We work around by doing the following.
var _legendTemplateObject = _legendTaggedTemplateLiteral(['<div style="font-size: 15px">', '<span class="credit">(', ')</span></div>'], ['<div style="font-size: 15px">', '<span class="credit">(', ')</span></div>']),
    _legendTemplateObject2 = _legendTaggedTemplateLiteral(['<div style="font-size: 11px; text-align: center;">', '</div>'], ['<div style="font-size: 11px; text-align: center;">', '</div>']),
    _legendTemplateObject3 = _legendTaggedTemplateLiteral(['<div style="font-size: 11px">', ' '], ['<div style="font-size: 11px">', ' ']),
    _legendTemplateObject4 = _legendTaggedTemplateLiteral(['<img src="', '" style="border:1px solid grey; width:200px; height:10px; margin-top:2px; position:relative; top:3px; background-color:black">'], ['<img src="', '" style="border:1px solid grey; width:200px; height:10px; margin-top:2px; position:relative; top:3px; background-color:black">']),
    _legendTemplateObject5 = _legendTaggedTemplateLiteral([' ', '</div>'], [' ', '</div>']);

function _legendTaggedTemplateLiteral(strings, raw) { return Object.freeze(Object.defineProperties(strings, { raw: { value: Object.freeze(raw) } })); }

var Legend = function Legend(id, str) {
    this.id = id;
    this.str = str;
};

Legend.prototype.toString = function legendToString() {
  var ret = '<tr id="' + this.id + '-legend" style="display: none"><td>' + this.str +'</td></tr>';
  return ret;
};

var BubbleMapLegend = function BubbleMapLegend(opts) {
    this.width = 240;
    this.height = 110;
    this.keyY = 10;
    this.keyOffset = 0.0;
    this.id = opts["id"];
    this.str = opts["str"] || this.setStr(opts);
    Legend.call(this, this.id, this.str);
};
BubbleMapLegend.prototype = Object.create(Legend.prototype);

BubbleMapLegend.prototype.setStr = function setStr(opts) {
    var that = this;
    function getKey(color, str) {
        var circle = '<circle class="gain" r="10" cx="15" cy="' + that.keyY + '" style="fill: ' + color + '; stroke: #fff;"></circle>';
        var text = '<text x="30" y="' + (that.keyY + 5.0) + '" style="font-size: 12px; fill: #e6e6e6">' + str + '</text>';
        return circle + text;
    }

    function getCircle(value, radius) {
        var text =  '<text text-anchor="middle" x="120.0" y="' + (that.height - 2.0*parseFloat(radius)) + '" dy="10" style="font-size: 10px; fill: #e6e6e6">' + value + '</text>';
        var circle = '<circle r="' + radius + '" cx="120.0" cy="' + (that.height - parseFloat(radius) - 5.0) + '" vector-effect="non-scaling-stroke" style="fill: none; stroke: #a7a7a7"></circle>';
        return circle + text;
    }

    this.height += opts["keys"] ? opts["keys"].length * 25.0 : 0.0;
    var div = '<div style="font-size: 15px">' + opts["title"] + '<span class="credit"> ('+ opts["credit"] +')</span></div>';
    var svg = '<svg class="svg-legend" width="240" height="'+ this.height + '">';
    var keys = '';
    if (opts["keys"]) {
        for (var i = 0; i < opts["keys"].length; i++) {
            keys += getKey(opts["keys"][i]['color'], opts["keys"][i]['str']);
            that.keyY += 25.0;
        }

    }
    var circles = '';
    for (var i = 0; i < opts["circles"].length; i++) {
        circles += getCircle(opts["circles"][i]['value'], opts["circles"][i]['radius']);
    }
    return div + svg + keys + circles + '</svg>';
};

var ChoroplethLegend = function ChoroplethLegend(opts) {
    this.width = 280;
    this.height = 80;
    this.xOffset = 0;
    this.xValueOffset = 0;
    this.id = opts["id"];
    this.str = opts["str"] || this.setStr(opts);
    this.keys = opts["keys"] || [];
    Legend.call(this, this.id, this.str);
};

ChoroplethLegend.prototype = Object.create(Legend.prototype);
ChoroplethLegend.prototype.safe = function(templateData) {
    var entityMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
    };

    var s = templateData[0];
    for (var i = 1; i < arguments.length; i++) {
        s += String(arguments[i]).replace(/[&<>"'`=\/]/g, function (s) { return entityMap[s]; });
        s += templateData[i];
    }
    return s;
};

ChoroplethLegend.prototype.setStr = function setStr(opts) {
    var that = this;

    function getKey(str) {
        var text = '<text x="140" y="10" text-anchor="middle" style="font-size: 12px; fill: #dcdbdb">' + str + '</text>';
        return text;
    }
    function getColor(color) {
        var rect = '<rect fill="' + color + '" y="20" x="' + that.xOffset + '" height="10" width="' + that.colorWidth + '"></rect>';
        return rect;
    }
    function getValue(value) {
        var text = '<text font-size="10px" fill="#e6e6e6" y="40" x="' + that.xOffset  + '" text-anchor="middle">' + value + '</text>';
        return text;
    }

    if (opts["colorMap"]) {
        var legend = '';
        legend += this.safe(_legendTemplateObject, opts["title"], opts["credit"]);
        if (opts["keys"].length > 0) {
            legend += this.safe(_legendTemplateObject2, opts["keys"][0]['str']);
        }
        legend += this.safe(_legendTemplateObject3, opts["values"][0]);
        legend += this.safe(_legendTemplateObject4, opts["colorMap"]);
        legend += this.safe(_legendTemplateObject5, opts["values"][opts["values"].length - 1]);
        return legend;
        //legend += safe` ${layerJson.legendMax} ${layerJson.legendUnits}</div>`;
    } else {
        var div = '<div style="font-size: 15px">' + opts["title"] + '<span class="credit"> ('+ opts["credit"] +')</span></div>';
        var svg = '<svg class="svg-legend" width="280" height="60">';
        var keys = '';
        if (opts["keys"]) {
            for (var i = 0; i < opts["keys"].length; i++) {
                keys += getKey(opts["keys"][i]['str']);
            }

        }

       var colors = '';
       this.colorWidth = this.width/opts["colors"].length;
        for (var i = 0; i < opts["colors"].length; i++) {
            colors += getColor(opts["colors"][i]);
            this.xOffset += this.colorWidth;
        }
        var values = '';
        this.xOffset = 0 + this.colorWidth*0.5;
        if (opts["values"].length == 2) {
            values += getValue(opts["values"][0]);
            this.xOffset += this.colorWidth*(opts["colors"].length - 1.);
            values += getValue(opts["values"][1]);
        } else if (opts["values"].length == 3) {
            values += getValue(opts["values"][0]);
            this.xOffset = this.width / 2;
            values += getValue(opts["values"][1]);
        this.xOffset = 0 + this.colorWidth*0.5;

            this.xOffset += this.colorWidth*(opts["colors"].length - 1.);
            values += getValue(opts["values"][2]);
        } else {
            this.valueWidth = this.width/opts["values"].length;
            for (var i = 0; i < opts["values"].length; i++) {
                values += getValue(opts["values"][i]);
                this.xOffset += this.valueWidth;
            }

        }
        return div + svg + keys + colors + values + '</svg>';
    }
};
