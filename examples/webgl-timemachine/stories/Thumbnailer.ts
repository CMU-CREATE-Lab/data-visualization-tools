export class Thumbnailer{
    thumbnailServerUrl: string;
    sharelink: string;
    hash: string;
    args: string[];
    headlessClientHost: string;
    apiUrl: string;


    constructor(sharelink: string) {
        this.thumbnailServerUrl = "https://thumbnails-v2.createlab.org/thumbnail?";
        // We no longer want to pass forceLegend to the thumbnail server, but it needs to
        // still be part of share links so that the mobile client knows to render a legend.
        this.sharelink = sharelink.replace(/&(forceLegend=true|forceLegend)/g,"");
        var hash = this.sharelink.split("#")[1];
        if (typeof hash !== "undefined") { // we passed a sharelink
            this.hash = hash;
            this.setArgs(this.hash);
        } else { // we passed a thumbnail server link
            var qsa = this.sharelink.split("?")[1];
            this.setArgs(qsa);
        }

        // @ts-ignore
        if (typeof window.EARTH_TIMELAPSE_CONFIG !== "undefined" && typeof window.EARTH_TIMELAPSE_CONFIG.headlessClientHost !== "undefined") {
            // @ts-ignore
            this.headlessClientHost = window.EARTH_TIMELAPSE_CONFIG.headlessClientHost;
        } else {
            this.headlessClientHost = "https://headless.earthtime.org/";
        }
        // @ts-ignore
        if (typeof window.EARTH_TIMELAPSE_CONFIG !== "undefined" && typeof window.EARTH_TIMELAPSE_CONFIG.apiUrl !== "undefined") {
            // @ts-ignore
            this.apUrl = window.EARTH_TIMELAPSE_CONFIG.apiUrl;
        } else {
            this.apiUrl = "https://api.earthtime.org/";
        }
        let sheetUrl = 'https://docs.google.com/spreadsheets/d/1heLmeuPp7j4itr0cK8H4chugOpp7cU8p_VEB9CFfPlY/edit#gid=1292578249'
        // @ts-ignore
        if (typeof window.EARTH_TIMELAPSE_CONFIG !== "undefined" && typeof window.EARTH_TIMELAPSE_CONFIG.csvLayersContentPath !== "undefined") {
            // @ts-ignore
            sheetUrl = window.EARTH_TIMELAPSE_CONFIG.csvLayersContentPath;
        }   
        var regex = /https?:\/\/docs\.google\.com\/spreadsheets\/d\/(.*?)\/(.*?[#&]gid=(\d+))?/;
        var match = sheetUrl.match(regex);
        if (!match) {
            throw Error(`url ${sheetUrl} does not match regex ${regex}, aborting`)
        }
        var gsheetId = match[1] + '.' + match[3];
        
        this.apiUrl += 'layer-catalogs/' + gsheetId;
    }

    setArgs(hash: string) {
        this.args = [];
        var argList = hash.split("&");
        for (var arg in argList) {
            var kv = argList[arg].split("=");
            if (kv.length  == 2) {
                var k = kv[0];
                var v = kv[1];
                this.args[k] = v;
            } else {
                this.args[kv[0]] = kv[0];
            }
        }
    }

    
    async getLayerInfo(layerId) {
        var apiUrl =  this.apiUrl + '/layers/' + layerId;
            try {
              const response = await fetch(apiUrl);
              if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
              }
              const data = await response.json();
              return data;
            }
            catch (error) {
              console.error(`Could not get layer info: ${error}`);
            }
          }
          

    
    getContentType() {
        let contentType = {
            'type': 'video',
            'layerString': ''
        };

        let extras = this.isExtras();
        if (extras) {
            contentType.type = 'extras';
            contentType.layerString = String(extras);

        } else if (this.isPicture()){
            contentType.type = 'picture';
        }
        return contentType;

    }

    isExtras() {
        var l = this.args['l'];
        let layers = l.split(',');
        var ret = false;
        for (var i = 0; i < layers.length; i++) {
            if (layers[i].includes('extras_')) {
                ret = layers[i];
            }
        }
        return ret;
    }
    isPicture() {
        var ps = this.args['ps'];
        var format = this.args['format'];
        var bt = this.args['bt'];
        var et = this.args['et'];

        if (typeof bt !== 'undefined' && typeof et !== 'undefined' && bt == et) {
            return true;
        } else if (typeof ps != "undefined") {
            if (parseFloat(ps) == 0.0) {
                return true;
            } else {
                return false;
            }
        } else if (typeof format !== "undefined") {
            if (format == "png" || format == "jpg") {
                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }
    }

    _setBt() {
        // Old sharelinks ommitted bt & et
        // Thumbnail server requires at least bt set
        var bt = this.args['bt'];
        if (typeof bt == "undefined") {
            var t = this.args['t'];
            if (typeof t == "undefined") {
                this.args["t"] = 0.0;
                this.args["bt"] = 0.0;
            } else {
                this.args["bt"] = t;
            }
        }
    }

    getMp4(orientation: string) {
        var orientation = orientation || "portrait";
        var widthPx = orientation == "portrait" ? 540 : 1280;
        var heightPx = 720;
        var url = this.thumbnailServerUrl;

        var root = "root=";
        if (typeof this.args["root"] == "undefined") {
            root += this.headlessClientHost;
            if (!('bt' in this.args)) {
                this._setBt();
                this.hash += "&bt=" + this.args['bt'];
            }
            root += encodeURIComponent('#' + this.hash);
        } else {
            root += this.args["root"];
        }

        var width = "width=" + widthPx;
        var height = "height=" + heightPx;
        var format = "format=" + "mp4";
        var fps = "fps=";
        if (typeof this.args["fps"] == "undefined") {
            fps += "30";
        } else {
            fps += this.args["fps"];
        }
        var tileFormat = "tileFormat=" + "mp4";

        var startDwell = "startDwell=";
        if (typeof this.args["startDwell"] == "undefined") {
            startDwell += "0";
        } else {
            startDwell += this.args["startDwell"];
        }
        var endDwell = "endDwell=";
        if (typeof this.args["endDwell"] == "undefined") {
            endDwell += "1.5";
        } else {
            endDwell += this.args["endDwell"];
        }

        var fromScreenshot = "fromScreenshot";
        var UI = '';
        if (typeof this.hash != "undefined") {
            UI += "timestampOnlyUI=" + "true";
        } else {
            if (typeof this.args['minimalUI'] != 'undefined') {
                UI = "minimalUI";
            }
            if (typeof this.args['timestampOnlyUI'] != 'undefined') {
                UI = "timestampOnlyUI=true";
            }
        }
        return url + [root,width,height,format,fps,tileFormat,startDwell,endDwell,fromScreenshot, UI].join("&");
    }

    getImage(orientation: string) {
        var orientation = orientation || "portrait";
        var widthPx = orientation == "portrait" ? 540 : 1280;
        var heightPx = 720;
        var url = this.thumbnailServerUrl;

        var root = "root=";
        if (typeof this.args["root"] == "undefined") {
            root += this.headlessClientHost;
            if (!('bt' in this.args)) {
                this._setBt();
                this.hash += "&bt=" + this.args['bt'];
            }
            root += encodeURIComponent('#' + this.hash);
        } else {
            root += this.args["root"];
        }

        var width = "width=" + widthPx;
        var height = "height=" + heightPx;

        var format = "format="
        if (typeof this.args["format"] == "undefined") {
            format += "jpg";
        } else {
            format += this.args["format"];
        }
        var fps = "fps=" + "30";
        var tileFormat = "tileFormat=" + "mp4";
        var fromScreenshot = "fromScreenshot";
        var UI = '';
        if (typeof this.hash != "undefined") {
            UI += "timestampOnlyUI=" + "true";
        } else {
            if (typeof this.args['minimalUI'] != 'undefined') {
                UI = "minimalUI";
            }
            if (typeof this.args['timestampOnlyUI'] != 'undefined') {
                UI = "timestampOnlyUI=true";
            }
        }
        return url + [root,width,height,format,fps,tileFormat,fromScreenshot,UI].join("&");
    }

    getLegend() {
        var url = this.thumbnailServerUrl;

        var root = "";
        if (typeof this.args["root"] == "undefined") {
            root += this.headlessClientHost;
            if (!('bt' in this.args)) {
                this._setBt();
                this.hash += "&bt=" + this.args['bt'];
            }
            root += encodeURIComponent('#' + this.hash);
        } else {
            root += this.args["root"];
        }
        // We need to remove disableUI from the request, so that a legend is part of the DOM
        // when the Thumbnail Server goes to scrape.
        // We have to decode the root, since it was previously encoded by one of the prior
        // calls of getImage or getMp4. And then we have to re-encode it back again.
        root = "root=" + encodeURIComponent(decodeURIComponent(root).replace(/&(disableUI=true|disableUI)/g,""));
        var width = "width=" + 1280;
        var height = "height=" + 720;
        var legendHTML = "legendHTML=true";
        var fromScreenshot = "fromScreenshot";
        var UI = "minimalUI";
        return url + [root,width,height,legendHTML,fromScreenshot,UI].join("&");
    }

    _latLonToWebMercator(latitude: number, longitude: number) {
        var x = (longitude + 180) * 256 / 360;
        var y = 128 - Math.log(Math.tan((latitude + 90) * Math.PI / 360)) * 128 / Math.PI;
        return [x, y];
    }

    _webMercatorToLatLon(xy: [number, number]) {
        var lat = Math.atan(Math.exp((128 - xy[1]) * Math.PI / 128)) * 360 / Math.PI - 90;
        var lng = xy[0] * 360 / 256 - 180;
        return [lat, lng];
    }

    _webMercatorToPixel(xy: [number, number], zoom: number) {
        var scale = 1 << zoom;
        return [Math.floor(xy[0] * scale), Math.floor(xy[1] * scale)]
    }


    _pixelToWebMercator(xy: [number, number], zoom: number) {
        var scale = 1 << zoom;
        return [xy[0] / scale, xy[1] / scale];
    }
}
