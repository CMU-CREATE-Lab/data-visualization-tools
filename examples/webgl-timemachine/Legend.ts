declare var d3: any;
import { WebGLVectorLayer2 } from './WebGLVectorLayer2';

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
    keys: any[];
    constructor(opts: BubbleMapLegendOptions) {
        super(opts.id);
        this.width = 240;
        this.height = 110;
        this.keyY = 10;
        this.keyOffset = 0.0;
        this.str = opts.str || this.setStr(opts);
        this.keys = opts.keys || [];
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
                that.keyY += 25.0;
            }
        }

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
    keys: any[];
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
            var textAnchor = "middle";
            var xPos = 140;
            // TODO: Depends upon font size and type
            if (str.length > 42) {
                textAnchor = "start";
                xPos = 0;
            }
            var text = `<text x="${xPos}" y="10" text-anchor="${textAnchor}" style="font-size: 12px; fill: #dcdbdb">${str}</text>`;
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
            var svg = `<svg class="svg-legend" width="${this.width}" height="50" style="margin-top:${marginTop}px;">`;
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

export class OpenPlanetLegend {
    max_value: number;
    min_value: number;
    max_bubble_size: number;
    min_bubble_size: number;
    scaleFunction: any;
    legend_values: any[];
    canvas_width: number;
    canvas_height: number;
    ctx_fillStyle: any;
    ctx_strokeStyle: any;
    ctx_lineWidth: any;
    ctx_font: any;
    units: any;
    canvas: any;
    ctx: any;
    positionBuffer: any;
    texcoordBuffer: any;
    texture: any;
    program: any;
    opts: any;
    ready: any;

    constructor(gl, opts) {
        this.opts = opts;
        // @ts-ignore
        let font = new FontFace("Roboto_regular", "url(../../css/fonts/Roboto/Roboto-Regular.woff2)");
        var that = this;
        font.load().then(function(font) {
            // @ts-ignore
            document.fonts.add(font);
            that.init(gl, opts, font);
        });
    }
    init(gl, opts, font) {
        this.max_value = opts.max_value;
        this.min_value = opts.min_value;
        this.program = opts.program;
        this.max_bubble_size = (typeof opts.max_bubble_size === 'undefined') ? 300 : opts.max_bubble_size;
        this.min_bubble_size = (typeof opts.min_bubble_size === 'undefined') ? 0 : opts.min_bubble_size;
        this.scaleFunction =  d3.scaleSqrt()
            .domain([this.min_value, this.max_value])
            .range([this.min_bubble_size, this.max_bubble_size])
            .clamp(true);
        this.legend_values = [
            Math.floor(0.25 * this.max_bubble_size),
            Math.floor(0.50 * this.max_bubble_size),
            Math.floor(0.75 * this.max_bubble_size),
            this.max_bubble_size
        ];

        this.canvas_width = (typeof opts.canvas_width === 'undefined') ? 800 : opts.canvas_width;
        this.canvas_height = (typeof opts.canvas_height === 'undefined') ? 330 : opts.canvas_height;
        this.ctx_fillStyle = (typeof opts.ctx_fillStyle === 'undefined') ? '#faf2eb' : opts.ctx_fillStyle;
        this.ctx_strokeStyle = (typeof opts.ctx_strokeStyle === 'undefined') ? '#faf2eb' : opts.ctx_strokeStyle;
        this.ctx_lineWidth = (typeof opts.ctx_lineWidth === 'undefined') ? 4 : opts.ctx_lineWidth;
        this.ctx_font = (typeof opts.ctx_font === 'undefined') ? "45px Roboto_regular, monospace" : opts.ctx_font;
        this.units = (typeof opts.units === 'undefined') ? "" : opts.units;

        this.canvas = document.createElement('canvas');
        this.canvas.width = this.canvas_width;
        this.canvas.height = this.canvas_height;
        this.ctx = this.canvas.getContext("2d");
        this.ctx.font = this.ctx_font;
        // this.ctx.fillStyle = "#f8355c";
        // this.ctx.fillRect(0, 0, 800, this.canvas.height);

        this.ctx.fillStyle = this.ctx_fillStyle;
        this.ctx.strokeStyle = this.ctx_strokeStyle;
        this.ctx.lineWidth = this.ctx_lineWidth;

        let x = this.max_bubble_size/2. + 5;
        let y = this.max_bubble_size + 20;

        for (var i = 0; i < this.legend_values.length; i++) {
            this.ctx.beginPath();
            this.ctx.arc(x, y-this.legend_values[i]/2.0, this.legend_values[i]/2.0, 0, 2 * Math.PI);
            this.ctx.stroke();
            this.ctx.closePath();

            this.ctx.beginPath();
            this.ctx.setLineDash([2, 5]);
            this.ctx.moveTo(x,     y-this.legend_values[i] - 2);
            this.ctx.lineTo(x + x+ x/8, y-this.legend_values[i] - 2);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
            this.ctx.closePath();
            this.ctx.fillText(String(Math.round(this.scaleFunction.invert(this.legend_values[i])).toLocaleString()), x+x+x/7, y-this.legend_values[i] - 2 + 14);
        }
        if (this.units != "") {
            this.ctx.fillText(this.units, x+x+x/7, y);
        }
        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        var x1 = 70;
        var x2 = x1 + this.canvas.width;
        var y1 = gl.canvas.height - this.canvas_height;
        var y2 = y1 + this.canvas.height;

        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            x1, y1, x2, y1, x1, y2, x1, y2, x2, y1, x2, y2
        ]), gl.STATIC_DRAW);

        this.texcoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texcoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
              0.0,  0.0, 1.0,  0.0, 0.0,  1.0,
              0.0,  1.0, 1.0,  0.0, 1.0,  1.0
          ]), gl.STATIC_DRAW);
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        // Set the parameters so we can render any size image.
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        // Upload the image into the texture.
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.ctx.canvas);
        gl.bindTexture(gl.TEXTURE_2D, null);
        this.ready = true;
    }

    draw(gl: any) {
        if (this.ready) {
            gl.enable(gl.BLEND);
            gl.useProgram(this.program);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
            var x1 = 88;
            var x2 = x1 + this.canvas.width;
            var y1 = gl.canvas.height - this.canvas_height - 75;
            var y2 = y1 + this.canvas.height;

            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
                x1, y1, x2, y1, x1, y2, x1, y2, x2, y1, x2, y2
            ]), gl.STATIC_DRAW);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
            gl.enableVertexAttribArray(this.program.a_position);
            gl.vertexAttribPointer(this.program.a_position, 2, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.texcoordBuffer);
            gl.enableVertexAttribArray(this.program.a_texcoord);
            gl.vertexAttribPointer(this.program.a_texcoord, 2, gl.FLOAT, false, 0, 0);

            // set the resolution
            gl.uniform2f(this.program.u_resolution, gl.canvas.width, gl.canvas.height);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            gl.bindTexture(gl.TEXTURE_2D, null);
            gl.disable(gl.BLEND);
            gl.bindTexture(gl.TEXTURE_2D, null);
        }
    }
}
