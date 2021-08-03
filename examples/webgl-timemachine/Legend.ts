//Legend.js

// Template literals (strings) are not supported in IE 11 (and other browsers that don't support ES6)
// We work around by doing the following.
var _legendTemplateObject = _legendTaggedTemplateLiteral(['<div style="font-size: 15px">', '<span class="credit">(', ')</span></div>'], ['<div style="font-size: 15px">', '<span class="credit">(', ')</span></div>']),
    _legendTemplateObject2 = _legendTaggedTemplateLiteral(['<div style="font-size: 11px; text-align: center;">', '</div>'], ['<div style="font-size: 11px; text-align: center;">', '</div>']),
    _legendTemplateObject3 = _legendTaggedTemplateLiteral(['<div style="font-size: 11px">', ' '], ['<div style="font-size: 11px">', ' ']),
    _legendTemplateObject4 = _legendTaggedTemplateLiteral(['<img src="', '" style="border:1px solid grey; width:200px; height:10px; margin-top:2px; position:relative; top:3px; background-color:black">'], ['<img src="', '" style="border:1px solid grey; width:200px; height:10px; margin-top:2px; position:relative; top:3px; background-color:black">']),
    _legendTemplateObject5 = _legendTaggedTemplateLiteral([' ', '</div>'], [' ', '</div>']);

function _legendTaggedTemplateLiteral(strings: string[], raw: string[]) { return Object.freeze(Object.defineProperties(strings, { raw: { value: Object.freeze(raw) } })); }

export class Legend {
    id: string;
    str: any;
    constructor(id: string, str: string = null) {
        this.id = id;
        this.str = str;
    }
    toString() {
        var ret = '<tr id="' + this.id + '-legend"><td>' + this.str + '</td></tr>';
        return ret;
    }
}

export interface BubbleMapLegendOptions {
    id?: any;
    title?: any;
    credit?: any;
    keys?: any[];
    circles?: { value: any; radius: string; }[];
    str?: string;
}

export class BubbleMapLegend extends Legend {
    width: number;
    height: number;
    keyY: number;
    keyOffset: number;
    id: string;
    str: string;
    constructor(opts: BubbleMapLegendOptions) {
        super(opts.id);
        this.width = 240;
        this.height = 110;
        this.keyY = 10;
        this.keyOffset = 0.0;
        this.str = opts.str || this.setStr(opts);
    }
    setStr(opts: BubbleMapLegendOptions) {
        var that = this;
        function getKey(color: string, str: string) {
            var circle = '<circle class="gain" r="10" cx="15" cy="' + that.keyY + '" style="fill: ' + color + '; stroke: #fff;"></circle>';
            var text = '<text x="30" y="' + (that.keyY + 5.0) + '" style="font-size: 12px; fill: #e6e6e6">' + str + '</text>';
            return circle + text;
        }

        function getCircle(value: string, radius: string) {
            var text = '<text text-anchor="middle" x="120.0" y="' + (that.height - 2.0 * parseFloat(radius)) + '" dy="10" style="font-size: 10px; fill: #e6e6e6">' + value + '</text>';
            var circle = '<circle r="' + radius + '" cx="120.0" cy="' + (that.height - parseFloat(radius) - 5.0) + '" vector-effect="non-scaling-stroke" style="fill: none; stroke: #a7a7a7"></circle>';
            return circle + text;
        }

        this.height += opts["keys"] ? opts["keys"].length * 25.0 : 0.0;
        var keys = '';
        if (opts["keys"]) {
            for (var i = 0; i < opts["keys"].length; i++) {
                keys += getKey(opts["keys"][i]['color'], opts["keys"][i]['str']);
                if (i == 0 && opts["keys"][i]['str'].length) {
                    this.width = 0;
                }
                that.keyY += 25.0;
                // TODO: This likely does not scale and certainly not with different fonts.
                // A way to properly address this is 'setAttribute' the width and height
                // based on the bbox of the svg once rendered on the page.
                this.width += opts["keys"][i]['str'].length * 8;
            }
        }
        this.width = Math.max(this.width, 240);

        var circles = '';
        for (var i = 0; i < opts["circles"].length; i++) {
            circles += getCircle(opts["circles"][i]['value'], opts["circles"][i]['radius']);
        }
        var div = '<div style="font-size: 15px">' + opts["title"] + '<span class="credit"> (' + opts["credit"] + ')</span></div>';
        var svg = '<svg class="svg-legend" width="' + this.width  + '" height="' + this.height + '">';
        return div + svg + keys + circles + '</svg>';
    }
}

export interface ChoroplethLegendOptions {
    id: string;
    title?: any;
    credit?: any;
    keys?: any[];
    circles?: { value: any; radius: string; }[];
    str?: any;
}

export class ChoroplethLegend extends Legend {
    width: number;
    height: number;
    xOffset: number;
    xValueOffset: number;
    id: any;
    str: any;
    keys: any;
    colorWidth: number;
    valueWidth: number;
    constructor(opts: ChoroplethLegendOptions) {
        super(opts.id);
        this.width = 280;
        this.height = 80;
        this.xOffset = 0;
        this.xValueOffset = 0;
        this.str = opts.str || this.setStr(opts);
        this.keys = opts.keys || [];
    }
    safe(templateData: readonly any[], ...argumnts: any[]) {
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
            s += String(arguments[i]).replace(/[&<>"'`=\/]/g, function(s) { return entityMap[s]; });
            s += templateData[i];
        }
        return s;
    }
    setStr(opts: ChoroplethLegendOptions) {
        var that = this;

        function getKey(str: string) {
            var text = '<text x="140" y="10" text-anchor="middle" style="font-size: 12px; fill: #dcdbdb">' + str + '</text>';
            return text;
        }
        function getColor(color: string) {
            if (typeof(color) !== "string") {
                color = rgbToHex(color);
            }
            var rect = '<rect fill="' + color + '" y="20" x="' + that.xOffset + '" height="10" width="' + that.colorWidth + '"></rect>';
            return rect;
        }
        function getValue(value: string) {
            var text = '<text font-size="10px" fill="#e6e6e6" y="40" x="' + that.xOffset + '" text-anchor="middle">' + value + '</text>';
            return text;
        }
        function rgbToHex(rgb) {
            return "#" + ((1 << 24) + (rgb[0] << 16) + (rgb[1] << 8) + rgb[2]).toString(16).slice(1);
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
        }
        else {
            var keys = '';
            if (opts["keys"]) {
                for (var i = 0; i < opts["keys"].length; i++) {
                    keys += getKey(opts["keys"][i]['str']);
                }

            }
            var marginTop = keys ? 0 : -15;
            var div = '<div style="font-size: 15px">' + opts["title"] + '<span class="credit"> ('+ opts["credit"] +')</span></div>';
            var svg = '<svg class="svg-legend" width="280" height="50" style="margin-top:' + marginTop + 'px;">';
            var colors = '';
            this.colorWidth = this.width / opts["colors"].length;
            for (var i = 0; i < opts["colors"].length; i++) {
                colors += getColor(opts["colors"][i]);
                this.xOffset += this.colorWidth;
            }
            var values = '';
            this.xOffset = 0 + this.colorWidth * 0.5;
            if (opts["values"].length == 2) {
                values += getValue(opts["values"][0]);
                this.xOffset += this.colorWidth * (opts["colors"].length - 1.);
                values += getValue(opts["values"][1]);
            }
            else if (opts["values"].length == 3) {
                values += getValue(opts["values"][0]);
                this.xOffset = this.width / 2;
                values += getValue(opts["values"][1]);
                this.xOffset = 0 + this.colorWidth * 0.5;
                this.xOffset += this.colorWidth * (opts["colors"].length - 1.);
                values += getValue(opts["values"][2]);
            }
            else {
                this.valueWidth = this.width / opts["values"].length;
                for (var i = 0; i < opts["values"].length; i++) {
                    values += getValue(opts["values"][i]);
                    this.xOffset += this.valueWidth;
                }
            }
            return div + svg + keys + colors + values + '</svg>';
        }
    }
}
