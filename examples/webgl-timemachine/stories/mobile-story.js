function Thumbnailer(sharelink) {
    this.sharelink = sharelink;
    this.hash = sharelink.split("#")[1];
    this.setArgs(this.hash);
} 

Thumbnailer.prototype.setArgs = function(hash) {
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

Thumbnailer.prototype.isPicture = function() {
    var ps = this.args['ps'];
    if (typeof ps != "undefined") {
        if (parseFloat(ps) == 0.0) {
            return true;
        } else {
            return false;
        }
    } else {
        return false;        
    }
}

Thumbnailer.prototype._setBt = function() {
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

Thumbnailer.prototype.getNWSE = function(orientation) {
    var orientation = orientation || "portrait";
    var regex = /v\=(.*),(.*),(.*),latLng/;
    var arr = this.hash.match(regex);
    var lat = parseFloat(arr[1]);
    var lng = parseFloat(arr[2]);
    var scale = parseFloat(arr[3]);
    var scale2zoom = d3.scaleLinear().domain([-1, 12]).range([0, 12]);
    var wm = this._latLonToWebMercator(lat,lng);
    var xy = this._webMercatorToPixel(wm, scale2zoom(scale));
    var width = orientation == "portrait" ? 540 : 1280;
    var height = 720;
    var pixelBoundingBox = [xy[1] - height*0.5, xy[0] - width*0.5, xy[1] + height*0.5, xy[0] + width*0.5]; //tlbr
    var tl = this._pixelToWebMercator([pixelBoundingBox[1], pixelBoundingBox[0]], scale2zoom(scale));
    var br = this._pixelToWebMercator([pixelBoundingBox[3], pixelBoundingBox[2]], scale2zoom(scale));
    var nwse = [];
    nwse  = this._webMercatorToLatLon(tl).concat(this._webMercatorToLatLon(br));
    return nwse;   
}

Thumbnailer.prototype.getMp4 = function(orientation) {
    var orientation = orientation || "portrait";
    var width = orientation == "portrait" ? 540 : 1280;
    var height = 720;    
    var url = "https://thumbnails-staging.cmucreatelab.org/thumbnail?";
    var root = "root=https://headless.earthtime.org/";
    if (!('bt' in this.args)) {
        this._setBt();
        this.hash += "&bt=" + this.args['bt'];
    }
    root += encodeURIComponent('#' + this.hash + "&timestampOnlyUI=true");

    //var boundsNWSE = "boundsNWSE=" + this.getNWSE(orientation).join(",");
    var width = "width=" + width;
    var height = "height=" + height;
    var format = "format=" + "mp4";
    var fps = "fps=" + "30";
    var tileFormat = "tileFormat=" + "mp4";
    var startDwell = "startDwell=" + "1.5";
    var endDwell = "endDwell=" + "1.5";
    var fromScreenshot = "fromScreenshot";
    return url + [root,width,height,format,fps,tileFormat,startDwell,endDwell,fromScreenshot].join("&");
}

Thumbnailer.prototype.getPng = function(orientation) {
    var orientation = orientation || "portrait";
    var width = orientation == "portrait" ? 540 : 1280;
    var height = 720;    
    var url = "https://thumbnails-staging.cmucreatelab.org/thumbnail?";
    var root = "root=https://headless.earthtime.org/";
    if (!('bt' in this.args)) {
        this._setBt();
        this.hash += "&bt=" + this.args['bt'];
    }
    //root += encodeURIComponent('#' + this.hash);
    root += encodeURIComponent('#' + this.hash + "&timestampOnlyUI=true");

    //var boundsNWSE = "boundsNWSE=" + this.getNWSE(orientation).join(",");
    var width = "width=" + width;
    var height = "height=" + height;
    var format = "format=" + "png";
    var fps = "fps=" + "30";
    var tileFormat = "tileFormat=" + "mp4";
    var fromScreenshot = "fromScreenshot";
    return url + [root,width,height,format,fps,tileFormat,fromScreenshot].join("&");
}

Thumbnailer.prototype._latLonToWebMercator = function(latitude, longitude) {
  var x = (longitude + 180) * 256 / 360;
  var y = 128 - Math.log(Math.tan((latitude + 90) * Math.PI / 360)) * 128 / Math.PI;
  return [x, y];
}

Thumbnailer.prototype._webMercatorToLatLon = function(xy) {
  var lat = Math.atan(Math.exp((128 - xy[1]) * Math.PI / 128)) * 360 / Math.PI - 90;
  var lng = xy[0] * 360 / 256 - 180;
  return [lat, lng];
};

Thumbnailer.prototype._webMercatorToPixel = function(xy, zoom) {
    var scale = 1 << zoom;
    return [Math.floor(xy[0] * scale), Math.floor(xy[1] * scale)]
}


Thumbnailer.prototype._pixelToWebMercator = function(xy, zoom) {
    var scale = 1 << zoom;
    return [xy[0] / scale, xy[1] / scale];    
}

// 

/*
function ShareLinkToObject(shareLink) {
    var obj = {};
    var hash = shareLink.split("#")[1];
    var args = hash.split("&");
    for (var arg in args) {
      var k = args[arg].split("=")[0];
      var v = args[arg].split("=")[1];
      obj[k] = v;
    }        
    return obj;
}

function isPicture(shareLink) {
    var returnValue = false;
    var hash = shareLink.split("#")[1];
    var args = hash.split("&");
    for (var arg in args) {
      var k = args[arg].split("=")[0];
      var v = args[arg].split("=")[1];
      if (k == "ps") {
        v = parseFloat(v);
        if (v == 0.0) {
            returnValue = true;          
        }
      }
    }        
    return returnValue;
}

function LatLonToWebMercator(latitude, longitude) {
  var x = (longitude + 180) * 256 / 360;
  var y = 128 - Math.log(Math.tan((latitude + 90) * Math.PI / 360)) * 128 / Math.PI;
  return [x, y];
}

function WebMercatorToLatLon(xy) {
  var lat = Math.atan(Math.exp((128 - xy[1]) * Math.PI / 128)) * 360 / Math.PI - 90;
  var lng = xy[0] * 360 / 256 - 180;
  return [lat, lng];
};

function WebMercatorToPixel(xy, zoom) {
    var scale = 1 << zoom;
    return [Math.floor(xy[0] * scale), Math.floor(xy[1] * scale)]
}


function PixelToWebMercator(xy, zoom) {
    var scale = 1 << zoom;
    return [xy[0] / scale, xy[1] / scale];    
}

function ShareLinkToNWSE(shareLink, orientation) {
    var orientation = orientation || "portrait";
    var hash = shareLink.split("#")[1];
    var regex = /v\=(.*),(.*),(.*),latLng/;
    var arr = hash.match(regex);
    var lat = parseFloat(arr[1]);
    var lng = parseFloat(arr[2]);
    var scale = parseFloat(arr[3]);
    var scale2zoom = d3.scaleLinear().domain([-1, 12]).range([0, 12]);
    var wm = LatLonToWebMercator(lat,lng);
    var xy = WebMercatorToPixel(wm, scale2zoom(scale));
    var width = orientation == "portrait" ? 540 : 1280;
    var height = 720;
    var pixelBoundingBox = [xy[1] - height*0.5, xy[0] - width*0.5, xy[1] + height*0.5, xy[0] + width*0.5]; //tlbr
    var tl = PixelToWebMercator([pixelBoundingBox[1], pixelBoundingBox[0]], scale2zoom(scale));
    var br = PixelToWebMercator([pixelBoundingBox[3], pixelBoundingBox[2]], scale2zoom(scale));
    var nwse = [];
    nwse  = WebMercatorToLatLon(tl).concat(WebMercatorToLatLon(br));
    return nwse;   
}

function ShareLinkToThumbnailUrl(shareLink, opts) {
    var obj = ShareLinkToObject(shareLink);
    var opts = opts || {};
    var orientation = opts.orientation || "portrait";
    var nwse = ShareLinkToNWSE(shareLink);
    var width = orientation == "portrait" ? 540 : 1280;
    var height = 720;
    var root = opts.root || "http://storage.googleapis.com/earthengine-timelapse/herwig/earthtime_annual_1984_2016/v05";    
    var nframes = opts.nframes || 33;
    var frameTime = opts.frameTime || 0.0; 
    if (typeof obj["t"] !== "undefined") {
        frameTime = obj["t"];
    }
    var tileFormat = opts.tileFormat || "mp4";
    var format = opts.format || "mp4";
    var fps = opts.fps || 6;
    var url = "https://thumbnails-staging.cmucreatelab.org/thumbnail?";
    url += "root=" + root;
    url += "&width=" + width;
    url += "&height=" + height;
    url += "&nframes=" + nframes;
    url += "&frameTime=" + frameTime;
    url += "&tileFormat=" + tileFormat;
    url += "&format=" + format;
    url += "&boundsNWSE=" + nwse.join(",");
    url += "&fps=" + fps;
    return url;
}

function ShareLinkToThumbnailUrl2(shareLink) {
    var nwse = ShareLinkToNWSE(shareLink);
    var hash = shareLink.split("#")[1];
    var url = "https://thumbnails-staging.cmucreatelab.org/thumbnail?";
    var root = "root=https://headless.earthtime.org/";
    root += encodeURIComponent('#' + hash);
    var boundsNWSE = "boundsNWSE=" + nwse.join(",");
    var width = "width=" + "540";
    var height = "height=" + "720";
    //var startFrame = "startFrame=" + "0";
    var format = "format=" + "mp4";
    var fps = "fps=" + "30";
    var tileFormat = "tileFormat=" + "mp4";
    var startDwell = "startDwell=" + "1.5";
    var endDwell = "endDwell=" + "1.5";
    var fromScreenshot = "fromScreenshot";
    //var minimalUI = "minimalUI";
    //var nframes = "nframes=10;"
    //return url + [root,boundsNWSE,width,height,startFrame,format,fps,tileFormat,startDwell,endDwell,fromScreenshot,minimalUI,nframes].join("&");
    //return url + [root,boundsNWSE,width,height,startFrame,format,fps,tileFormat,startDwell,endDwell,fromScreenshot,nframes].join("&");
    return url + [root,boundsNWSE,width,height,format,fps,tileFormat,startDwell,endDwell,fromScreenshot].join("&");
}
*/

var objectFitImages = function() {
        "use strict";

        function t(t, e) {
            return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='" +
                t + "' height='" + e + "'%3E%3C/svg%3E"
        }

        function e(t) {
            if (t.srcset && !h && window.picturefill) {
                var e = window.picturefill._;
                t[e.ns] && t[e.ns].evaled || e.fillImg(t, {
                    reselect: !0
                }), t[e.ns].curSrc || (t[e.ns].supported = !1, e.fillImg(t, {
                    reselect: !0
                })), t.currentSrc = t[e.ns].curSrc || t.src
            }
        }

        function i(t) {
            for (var e, i = getComputedStyle(t).fontFamily, n = {}; null !== (e =
                    l.exec(i));) n[e[1]] = e[2];
            return n
        }

        function n(e, i, n) {
            var r = t(i || 1, n || 0);
            g.call(e, "src") !== r && m.call(e, "src", r)
        }

        function r(t, e) {
            t.naturalWidth ? e(t) : setTimeout(r, 100, t, e)
        }

        function o(t) {
            var o = i(t),
                a = t[c];
            if (o["object-fit"] = o["object-fit"] || "fill", !a.img) {
                if ("fill" === o["object-fit"]) return;
                if (!a.skipTest && p && !o["object-position"]) return
            }
            if (!a.img) {
                a.img = new Image(t.width, t.height), a.img.srcset = g.call(t,
                        "data-ofi-srcset") || t.srcset, a.img.src = g.call(t,
                        "data-ofi-src") || t.src, m.call(t, "data-ofi-src", t.src),
                    t.srcset && m.call(t, "data-ofi-srcset", t.srcset), n(t, t.naturalWidth ||
                        t.width, t.naturalHeight || t.height), t.srcset && (t.srcset =
                        "");
                try {
                    s(t)
                } catch (t) {
                    window.console && console.warn(
                        "https://bit.ly/ofi-old-browser")
                }
            }
            e(a.img), t.style.backgroundImage = 'url("' + (a.img.currentSrc ||
                    a.img.src).replace(/"/g, '\\"') + '")', t.style.backgroundPosition =
                o["object-position"] || "center", t.style.backgroundRepeat =
                "no-repeat", t.style.backgroundOrigin = "content-box",
                /scale-down/.test(o["object-fit"]) ? r(a.img, function() {
                    a.img.naturalWidth > t.width || a.img.naturalHeight > t
                        .height ? t.style.backgroundSize = "contain" : t.style
                        .backgroundSize = "auto"
                }) : t.style.backgroundSize = o["object-fit"].replace("none",
                    "auto").replace("fill", "100% 100%"), r(a.img, function(e) {
                    n(t, e.naturalWidth, e.naturalHeight)
                })
        }

        function s(t) {
            var e = {
                get: function(e) {
                    return t[c].img[e || "src"]
                },
                set: function(e, i) {
                    return t[c].img[i || "src"] = e, m.call(t,
                        "data-ofi-" + i, e), o(t), e
                }
            };
            Object.defineProperty(t, "src", e), Object.defineProperty(t,
                "currentSrc", {
                    get: function() {
                        return e.get("currentSrc")
                    }
                }), Object.defineProperty(t, "srcset", {
                get: function() {
                    return e.get("srcset")
                },
                set: function(t) {
                    return e.set(t, "srcset")
                }
            })
        }

        function a(t, e) {
            var i = !y && !t;
            if (e = e || {}, t = t || "img", f && !e.skipTest || !d) return !1;
            "img" === t ? t = document.getElementsByTagName("img") : "string" ==
                typeof t ? t = document.querySelectorAll(t) : "length" in t ||
                (t = [t]);
            for (var n = 0; n < t.length; n++) t[n][c] = t[n][c] || {
                skipTest: e.skipTest
            }, o(t[n]);
            i && (document.body.addEventListener("load", function(t) {
                "IMG" === t.target.tagName && a(t.target, {
                    skipTest: e.skipTest
                })
            }, !0), y = !0, t = "img"), e.watchMQ && window.addEventListener(
                "resize", a.bind(null, t, {
                    skipTest: e.skipTest
                }))
        }
        var c = "bfred-it:object-fit-images",
            l = /(object-fit|object-position)\s*:\s*([-\w\s%]+)/g,
            u = "undefined" == typeof Image ? {
                style: {
                    "object-position": 1
                }
            } : new Image,
            p = "object-fit" in u.style,
            f = "object-position" in u.style,
            d = "background-size" in u.style,
            h = "string" == typeof u.currentSrc,
            g = u.getAttribute,
            m = u.setAttribute,
            y = !1;
        return a.supportsObjectFit = p, a.supportsObjectPosition = f,
            function() {
                function t(t, e) {
                    return t[c] && t[c].img && ("src" === e || "srcset" === e) ?
                        t[c].img : t
                }
                f || (HTMLImageElement.prototype.getAttribute = function(e) {
                    return g.call(t(this, e), e)
                }, HTMLImageElement.prototype.setAttribute = function(e,
                    i) {
                    return m.call(t(this, e), e, String(i))
                })
            }(), a
    }();

var objectFitVideos = function(t) {
        "use strict";

        function e(t) {
            for (var e = getComputedStyle(t).fontFamily, i = null, n = {}; null !==
                (i = u.exec(e));) n[i[1]] = i[2];
            return n["object-position"] ? r(n) : n
        }

        function i(t) {
            var i = -1;
            t ? "length" in t || (t = [t]) : t = document.querySelectorAll(
                "video");
            for (; t[++i];) {
                var r = e(t[i]);
                (r["object-fit"] || r["object-position"]) && (r["object-fit"] =
                    r["object-fit"] || "fill", n(t[i], r))
            }
        }

        function n(t, e) {
            function i() {
                var i = t.videoWidth,
                    r = t.videoHeight,
                    s = i / r,
                    a = o.clientWidth,
                    c = o.clientHeight,
                    l = a / c,
                    u = 0,
                    p = 0;
                n.marginLeft = n.marginTop = 0, (s < l ? "contain" === e[
                        "object-fit"] : "cover" === e["object-fit"]) ? (u = c *
                        s, p = a / s, n.width = Math.round(u) + "px", n.height =
                        c + "px", "left" === e["object-position-x"] ? n.marginLeft =
                        0 : "right" === e["object-position-x"] ? n.marginLeft =
                        Math.round(a - u) + "px" : n.marginLeft = Math.round((a -
                            u) / 2) + "px") : (p = a / s, n.width = a + "px", n
                        .height = Math.round(p) + "px", "top" === e[
                            "object-position-y"] ? n.marginTop = 0 : "bottom" ===
                        e["object-position-y"] ? n.marginTop = Math.round(c - p) +
                        "px" : n.marginTop = Math.round((c - p) / 2) + "px"), t
                    .autoplay && t.play()
            }
            if ("fill" !== e["object-fit"]) {
                var n = t.style,
                    r = window.getComputedStyle(t),
                    o = document.createElement("object-fit");
                o.appendChild(t.parentNode.replaceChild(o, t));
                var s = {
                    height: "100%",
                    width: "100%",
                    boxSizing: "content-box",
                    display: "inline-block",
                    overflow: "hidden"
                };
                "backgroundColor backgroundImage borderColor borderStyle borderWidth bottom fontSize lineHeight left opacity margin position right top visibility"
                .replace(/\w+/g, function(t) {
                    s[t] = r[t]
                });
                for (var a in s) o.style[a] = s[a];
                n.border = n.margin = n.padding = 0, n.display = "block", n.opacity =
                    1, t.addEventListener("loadedmetadata", i), window.addEventListener(
                        "optimizedResize", i), t.readyState >= 1 && (t.removeEventListener(
                        "loadedmetadata", i), i())
            }
        }

        function r(t) {
            return ~t["object-position"].indexOf("left") ? t[
                    "object-position-x"] = "left" : ~t["object-position"].indexOf(
                    "right") ? t["object-position-x"] = "right" : t[
                    "object-position-x"] = "center", ~t["object-position"].indexOf(
                    "top") ? t["object-position-y"] = "top" : ~t[
                    "object-position"].indexOf("bottom") ? t[
                    "object-position-y"] = "bottom" : t["object-position-y"] =
                "center", t
        }

        function o(t, e, i) {
            i = i || window;
            var n = !1,
                r = null;
            try {
                r = new CustomEvent(e)
            } catch (t) {
                r = document.createEvent("Event"), r.initEvent(e, !0, !0)
            }
            var o = function() {
                n || (n = !0, requestAnimationFrame(function() {
                    i.dispatchEvent(r), n = !1
                }))
            };
            i.addEventListener(t, o)
        }
        var s = navigator.userAgent.indexOf("Edge/") >= 0,
            a = new Image,
            c = "object-fit" in a.style && !s,
            l = "object-position" in a.style && !s,
            u = /(object-fit|object-position)\s*:\s*([-\w\s%]+)/g;
        c && l || (i(t), o("resize", "optimizedResize"))
    };
/* GI SCRIPT START */
var giapp = giapp || {};
var giProject = function() {
    giapp.ios = parseFloat(("" + (
            /CPU.*OS ([0-9_]{1,5})|(CPU like).*AppleWebKit.*Mobile/i
            .exec(navigator.userAgent) || [0, ""])[1]).replace(
            "undefined", "3_2").replace("_", ".").replace("_", "")) || !1;
    giapp.mobile = window.isMobileAndTablet();
    giapp.orientation = giapp.setOrientation();
    giapp.setFixed();
    giapp.width = giapp.getWidth();
    giapp.setVideo();
    giapp.setMaps();
//    giapp.setSocial(); //TODO: MAYBE ADD SOCIAL BACK
    bLazy = new Blazy({
        offset: 1E3,
        success: function(c) {
            Waypoint.refreshAll()
        }
    });
    giapp.setResize(giapp.mobile);
    objectFitImages();
    giapp.waypoints();
    setTimeout(function() {
        Waypoint.refreshAll();
        bLazy.revalidate()
    }, 1E3);
    var c = document.querySelector("#video0");
    giapp.playVideo(c);
    new VHChromeFix([{
        selector: ".gi-card__caption",
        vh: 100
    }, {
        selector: ".gi-card__caption-trigger",
        vh: 50
    }])
};

giapp.setResize = function(c) {
    if (c) window.addEventListener("orientationchange", function() {
        giapp.setFixed();
        Waypoint.refreshAll();
        bLazy.revalidate()
    });
    else {
        window.addEventListener("resize", function() {
            b || (b = setTimeout(function() {
                b = null;
                Waypoint.refreshAll();
                bLazy.revalidate();
                giapp.setFixed();
                objectFitImages();
                objectFitVideos()
            }, 1E3))
        }, !1);
        var b
    }
};
giapp.setFixed = function() {
    var c = navigator.userAgent.toLowerCase(),
        b = /chrome/.test(c) && /android/.test(c);
    c = /crios/.test(c);
    b = b || c ? 45 : 0;
    c = document.querySelectorAll(".gi-card--fixed");
    for (var a = 0; a < c.length; a++) {
        var d = c[a].clientHeight + b;
        getClosestUp(c[a], ".gi-fixed-wrapper").style.height = d + "px"
    }
};
giapp.setOrientation = function() {
    return window.innerWidth > window.innerHeight ? "landscape" :
        "portrait"
};
giapp.getWidth = function() {
    return window.innerWidth
};
giapp.playVideo = function(c) {
    if (10 <= giapp.ios || 0 == giapp.ios) c.play(), giapp.curVideo = c
};
giapp.pauseVideo = function() {
    if (10 <= giapp.ios || 0 == giapp.ios) {
        var c = giapp.curVideo;
        giapp.mobile || c.pause();
        giapp.curVideo = null
    }
};
giapp.playPauseVideo = function(c, b) {
    var a = getClosestUp(c.target, ".gi-card__video-parent"),
        d = a.querySelector("video"),
        f = a.querySelector(".gi-video__button");
    a = a.querySelector(".gi-video__audio-anim");
    d.muted && (d.volume = 1, d.muted = !1, d.controls = !0, d.removeAttribute(
        "muted"));
    b ? (d.currentTime = 0, a.classList.add("hidden"), giapp.playVideo(d)) :
        d.paused ? (giapp.playVideo(d), f.classList.add("hidden"), d.controls = !
            0) : (giapp.pauseVideo(d), f.classList.remove("hidden"), d.controls = !
            1)
};
giapp.waypoints = function() {
    for (var c = document.querySelector(".gi-header"), b = document.querySelectorAll(
            ".gi-card__asset--inline.js-video-autoplay"), a = 0; a < b.length; a++)
        (function() {
            new Waypoint({
                element: b[a],
                handler: function(a) {
                    if ("down" == a) {
                        a = this.element;
                        var c = getClosestUp(a,
                                ".gi-card__video-parent"),
                            b = c.querySelector(
                                ".gi-video__button"),
                            e = c.querySelector(
                                ".gi-video__audio-anim");
                        c.classList.contains(
                            "js-video-played") || (
                            giapp.playVideo(a), b.classList
                            .add("hidden"), 1 == a.muted &&
                            e.classList.remove("hidden")
                        )
                    }
                },
                offset: "bottom-in-view"
            })
        })(), giapp.mobile && function() {
            new Waypoint({
                element: b[a],
                handler: function(a) {
                    if ("down" == a) {
                        a = this.element;
                        var c = a.getElementsByTagName("source")[
                            0];
                        c.src = "";
                        a.load()
                    } else {
                        var b = getClosestUp(this.element,
                                ".gi-card__video-parent"),
                            e = giapp.orientation;
                        a = b.querySelector("video");
                        c = a.getElementsByTagName("source")[0];
                        var d = b.getAttribute(
                                "data-video-autoplay"),
                            g = b.getAttribute(
                                "data-video-filename"),
                            l = b.getAttribute(
                                "data-video-portrait"),
                            f = b.getAttribute(
                                "data-cache-buster");
                        f = void 0 != f ? "?token=" + f : "";
                        /*
                        c.src = "true" == l ? g + "_" + e +
                            ".mp4" + f : g + "_landscape.mp4" +
                            f;
                        */
                        c.src = "true" == l ? ShareLinkToThumbnailUrl(g, {'orientation': 'portrait'}) + f : ShareLinkToThumbnailUrl(g, {'orientation': 'landscape'}) + f;                            
                        a.load();
                        d && (c = b.querySelector(
                                ".gi-video__button"), e = b
                            .querySelector(
                                ".gi-video__audio-anim"), b
                            .classList.contains(
                                "js-video-played") || (
                                giapp.playVideo(a), c.classList
                                .add("hidden"), 1 == a.muted &&
                                e.classList.remove("hidden")
                            ))
                    }
                },
                offset: "-100%"
            })
        }();
    var d = document.querySelectorAll(".gi-asset--fixed");
    for (a = 0; a < d.length; a++)(function() {
        var b = d[a].querySelector(".gi-card--fixed");
        new Waypoint({
            element: d[a],
            handler: function(a) {
                giapp.curMediaBlock =
                    this.element.querySelectorAll(
                        ".gi-card__media");
                giapp.curMediaBlockContent = this.element
                    .querySelectorAll(
                        ".gi-card__content");
                "down" == a ? (b.classList.add("sticky"),
                        b.classList.contains(
                            "gi-card--title") || c.classList
                        .toggle(
                            "gi-header--transparent"),
                        giapp.curMediaBlockIndex =
                        getChildIndex(this.element)) :
                    (b.classList.remove("sticky"), b.classList
                        .contains("gi-card--title") ||
                        c.classList.remove(
                            "gi-header--transparent"))
            }
        });
        new Waypoint({
            element: d[a],
            handler: function(a) {
                giapp.curMediaBlock = this.element.querySelectorAll(
                    ".gi-card__media");
                giapp.curMediaBlockContent = this.element
                    .querySelectorAll(
                        ".gi-card__content");
                "down" == a ? (b.classList.remove(
                    "sticky"), b.classList.add(
                    "bottom")) : (b.classList.add(
                    "sticky"), b.classList.remove(
                    "bottom"))
            },
            offset: "bottom-in-view"
        });
        new Waypoint({
            element: d[a],
            handler: function(a) {
                c.classList.toggle(
                    "gi-header--transparent")
            },
            offset: function() {
                return -this.element.clientHeight
            }
        })
    })();
    var f = document.querySelectorAll(".gi-lazy");
    for (a = 0; a < f.length; a++)(function() {
        new Waypoint({
            element: f[a],
            handler: function(a) {
                this.element.classList.add("active")
            },
            offset: "90%"
        })
    })();
    var k = document.querySelectorAll(".js-gi-trigger");
    for (a = 0; a < k.length; a++) {
        (function() {
            new Waypoint({
                element: k[a],
                handler: function(a) {
                    var b = getClosestUp(this.element,
                            ".gi-asset"),
                        c = b.querySelector(
                            ".gi-card__map--1"),
                        d = b.querySelector(
                            ".gi-card__asset--graphic-svg");
                    b = this.element.getAttribute(
                        "data-scale");
                    var e = this.element.getAttribute(
                            "data-duration"),
                        g = this.element.getAttribute(
                            "data-draw");
                    "down" == a && (b && (c.style.transform =
                            "scale(" + b +
                            ") rotate(0.01deg)", c.style
                            .WebkitTransform =
                            "scale(" + b + ")", c.style
                            .transitionDuration = e), 1 ==
                        g && setTimeout(function() {
                                function a(a, b) {
                                    b.style.strokeDasharray = [
                                        a.length, a
                                        .pathLength
                                    ].join(" ")
                                }
                                var b = document.querySelector(
                                        "#route"),
                                    c = document.querySelectorAll(
                                        ".gi-route-marker"
                                    );
                                tl = new TimelineMax({
                                    repeat: !1,
                                    yoyo: !1
                                });
                                tl.set([c], {
                                    autoAlpha: 0
                                });
                                tl.add(function(b) {
                                    var c = {
                                        length: 0,
                                        pathLength: b
                                            .getTotalLength()
                                    };
                                    return TweenLite
                                        .to(c,
                                            2.5, {
                                                length: c
                                                    .pathLength,
                                                onUpdate: a,
                                                onUpdateParams: [
                                                    c,
                                                    b
                                                ],
                                                immediateRender:
                                                    !
                                                    0,
                                                ease: Power1
                                                    .easeInOut
                                            })
                                }(b));
                                d.classList.add(
                                    "active")
                            },
                            1500))
                },
                offset: "100%"
            })
        })();
        (function() {
            new Waypoint({
                element: k[a],
                handler: function(a) {
                    var b = getClosestUp(this.element,
                            ".gi-asset").querySelector(
                            ".gi-card__map--1"),
                        c = this.element.getAttribute(
                            "data-scale");
                    "up" == a && c && (b.style.transform =
                        "scale(" + c +
                        ") rotate(0.01deg)", b.style.WebkitTransform =
                        "scale(" + c + ")", b.style.transitionDuration =
                        "1.5s")
                },
                offset: function() {
                    return -this.element.clientHeight
                }
            })
        })();
        var q = document.querySelector(".gi-card__content-title");
        (function() {
            new Waypoint({
                element: q,
                handler: function(a) {
                    "down" ==
                    a ? (c.classList.add(
                                "gi-header--active"), c.classList
                            .add("gi-header--transparent")) :
                        (c.classList.remove(
                                "gi-header--active"), c.classList
                            .remove(
                                "gi-header--transparent"))
                },
                offset: function() {
                    return -this.element.clientHeight
                }
            })
        })()
    }
    k = document.querySelectorAll(".js-gi-media");
    for (a = 0; a < k.length; a++)(function() {
            new Waypoint({
                element: k[a],
                handler: function(a) {
                    var b = parseInt(this.element.getAttribute(
                            "data-media-target")),
                        c = this.element.getAttribute(
                            "data-media-type"),
                        d = getClosestUp(this.element,
                            ".gi-asset").querySelector(
                            '[data-media="' +
                            b + '"]');
                    "photo" != c && "video" != c || "video" !=
                        c || "down" != a || (c = d.querySelector(
                            "video"), "video0" != c.getAttribute(
                            "id") && (null != giapp.curVideo &&
                            (giapp.curVideo.classList.contains(
                                "gi-card__asset--inline"
                            ) || giapp.pauseVideo()), c
                            .classList.contains(
                                "js-video-autoplay") &&
                            giapp.playVideo(c)));
                    0 != b && d.classList.toggle("active");
                    "down" == a ? (d.classList.add(
                        "showing"), 0 < b && giapp.curMediaBlock[
                        b - 1] && giapp.curMediaBlock[
                        b - 1].classList.remove(
                        "showing"), giapp.interactiveTracking(
                        "Interactive - Amazon - Media Group " +
                        giapp.curMediaBlockIndex +
                        " Item " + b)) : 0 < b && (d.classList
                        .toggle("showing"), giapp.curMediaBlock[
                            b - 1].classList.add(
                            "showing"));
                    if (3 <= b && "down" == a && (c =
                            parseInt(b - 3), giapp.curMediaBlock[
                                c])) {
                        giapp.curMediaBlock[c].classList.add(
                            "remove");
                        var e = giapp.curMediaBlock[c].querySelector(
                            ".gi-card__video-parent");
                        e && (c = e.querySelector("video"),
                            d = c.getElementsByTagName(
                                "source")[0], d.src =
                            "", c.load())
                    }
                    c = 4 <= giapp.curMediaBlock.length ? 3 :
                        1;
                    if (b < giapp.curMediaBlock.length - c &&
                        "down" == a)
                        for (d = 1; d <= c; d++) {
                            var g = giapp.curMediaBlock[b +
                                    d],
                                f = giapp.curMediaBlockContent[
                                    parseInt(b + d)].getAttribute(
                                    "data-media-type");
                            if ("photo" == f || "video" ==
                                f) g = g.querySelector(
                                    ".gi-card__asset"), g.classList
                                .contains("b-loaded") ||
                                "photo" == f && bLazy.load(
                                    g, !0)
                        }
                    3 <= b && "up" == a && (c = parseInt(b -
                                3), giapp.curMediaBlock[c].classList
                            .remove("remove"), e = giapp.curMediaBlock[
                                c].querySelector(
                                ".gi-card__video-parent")) &&
                        (a = giapp.orientation, c = e.querySelector(
                                "video"), d = c.getElementsByTagName(
                                "source")[0], f = e.getAttribute(
                                "data-video-filename"), g =
                            e.getAttribute(
                                "data-video-portrait"),
                            e = e.getAttribute(
                                "data-cache-buster"), e =
                            /*
                            void 0 != e ? "?token=" + e :
                            "", d.src = "true" == g ? f +
                            "_" + a + ".mp4" + e : f +
                            "_landscape.mp4" + e, c.load());
                            */
                            void 0 != e ? "?token=" + e :
                            "", d.src = "true" == g ? new Thumbnailer(f).getMp4("portrait") + e : new Thumbnailer(f).getMp4('landscape') + e, c.load());
//                            "", d.src = "true" == g ? ShareLinkToThumbnailUrl(f, {'orientation': 'portrait'}) + e : ShareLinkToThumbnailUrl(f, {'orientation': 'landscape'}) + e, c.load());
                    giapp.curSlide = b
                },
                offset: "100%"
            })
        })(),
        function() {
            new Waypoint({
                element: k[a],
                handler: function(a) {
                    if ("up" == a && "video" == this.element.getAttribute(
                            "data-media-type")) {
                        a = this.element.getAttribute(
                            "data-media-target");
                        getClosestUp(this.element, ".gi-asset");
                        if (a = giapp.curMediaBlock[a]) var b =
                            a.querySelector("video");
                        null != giapp.curVideo && giapp.pauseVideo();
                        b && (b.classList.contains(
                                "js-video-autoplay") ?
                            giapp.playVideo(b) : a.querySelector(
                                ".gi-video__button").classList
                            .remove("hidden"))
                    }
                },
                offset: function() {
                    return -this.element.clientHeight
                }
            })
        }()
};
giapp.setMaps = function() {
    for (var c = document.querySelectorAll(".gi-map"), b = 0; b < c.length; b++) {
        var a = c[b].getAttribute("data-key");
        maps[a].el = "#" + a;
        new Pinpoint(maps[a])
    }
};
giapp.setVideo = function() {
    for (var c = giapp.orientation, b = document.querySelectorAll(
            ".gi-card__video-parent"), a = 0; a < b.length; a++)(function() {
        var d = b[a].getAttribute("data-video-title"),
            f = b[a].getAttribute("data-video-filename"),
            k = b[a].getAttribute("data-video-poster"),
            q = b[a].getAttribute("data-video-portrait"),
            e = b[a].getAttribute("data-video-contain"),
            n = b[a].getAttribute("data-video-autoplay"),
            m = b[a].getAttribute("data-video-inline"),
            u = b[a].getAttribute("data-video-loop"),
            p = b[a].getAttribute("data-video-caption"),
            g = b[a].getAttribute("data-video-duration"),
            l = b[a].getAttribute("data-cache-buster"),
            v = p ? '<track id="videoTrack' + a +
            '" label="English captions" src="' + p +
            '" kind="metadata" srclang="en" default>' : "";
        if ("true" == n) {
            g = m ?
                "<div class='gi-video__button gi-video__button--play hidden'><button class='gi-button gi-button--dark gi-button--video' aria-label='Play Video'><svg class='gi-button__icon' role='img' pointer-events='none' focusable='false' aria-hidden='true'><use xmlns:xlink='http://www.w3.org/1999/xlink' xlink:href='https://www.theglobeandmail.com/files/interactive/world/amazon/images/sprite.svg#icon-play'></use></svg><div><span class='gi-button--video__label'>Play Video</span><span class='gi-button--video__time'>" +
                g +
                "</span></div></button></div><div class='gi-video__audio-anim'><div class='gi-video__audio-bars'><div class='gi-video__audio-bar'></div><div class='gi-video__audio-bar'></div><div class='gi-video__audio-bar'></div></div></div>" :
                "";
            var t = "js-video-autoplay",
                r = "muted"
        } else g =
            "<div class='gi-video__button gi-video__button--play'><button class='gi-button gi-button--dark gi-button--video' aria-label='Play Video'><svg class='gi-button__icon' role='img' pointer-events='none' focusable='false' aria-hidden='true'><use xmlns:xlink='http://www.w3.org/1999/xlink' xlink:href='https://www.theglobeandmail.com/files/interactive/world/amazon/images/sprite.svg#icon-play'></use></svg><div><span class='gi-button--video__label'>Play Video</span><span class='gi-button--video__time'>" +
            g + "</span></div></button></div>", r = t = "";
        l = void 0 != l ? "?token=" + l : "";
        d = '<video id="video' + a + '" preload="none" ' + ("true" ==
                u ? "loop" : "") + " " + r +
            ' playsinline poster="" class="gi-card__asset ' + (
                "true" == m ? "gi-card__asset--inline" : "no-tint") +
            " " + ("true" == d ? "b-lazy-manual" : "") + " " + t +
            '"><source type="video/mp4" />' + v + "</video>" + g;
        b[a].innerHTML = "";
        b[a].innerHTML = d;
        var h = b[a].querySelector("video");
        d = h.getElementsByTagName("source")[0];
        h.classList.remove("portrait-contain");
        h.classList.remove("landscape-contain");
        "false" != e && ("portrait" == e ? h.classList.add(
                "portrait-contain") : "landscape" == e ? h.classList
            .add("landscape-contain") : (h.classList.add(
                "landscape-contain"), h.classList.add(
                "portrait-contain")));
        // Sets _portrait vs _landscape
        // This is where I think we set the actual video URL
        /*
        "true" == q ? (d.src = f + "_" + c + ".mp4" + l, h.setAttribute(
            "poster", k + "_" + c + ".jpg" + l)) : (d.src = f +
            "_landscape.mp4" + l, h.setAttribute("poster", k +
                "_landscape.jpg" + l));
        */
        var mp4Options = {'orientation': c};
        var pngOptions = {'orientation': c,
                          'nframes':1,
                           'format': 'png'};
        var thumbnail = new Thumbnailer(f);
        /*
        "true" == q ? (d.src = ShareLinkToThumbnailUrl(f, mp4Options) + l, 
                       h.setAttribute("poster", ShareLinkToThumbnailUrl(k,pngOptions) + l)) : 
                      (d.src = ShareLinkToThumbnailUrl(f,mp4Options) + l, 
                       h.setAttribute("poster", ShareLinkToThumbnailUrl(k,pngOptions) + l));
        */
        "true" == q ? (d.src = thumbnail.getMp4(c) + l, 
                       h.setAttribute("poster", thumbnail.getPng(c) + l)) : 
                      (d.src = thumbnail.getMp4(c) + l, 
                       h.setAttribute("poster", thumbnail.getPng(c) + l));

        "true" != n && b[a].querySelector(".gi-video__button").addEventListener(
            "click",
            function(a) {
                giapp.playPauseVideo(a, !1)
            });
        "true" == n && m && (b[a].querySelector(
            ".gi-video__audio-anim").addEventListener(
            "click",
            function(a) {
                giapp.playPauseVideo(a, !0)
            }), b[a].querySelector(".gi-video__button").addEventListener(
            "click",
            function(a) {
                giapp.playPauseVideo(a, !1)
            }));
        "true" == m && (h.onended = function(a) {
            a = getClosestUp(a.target,
                ".gi-card__video-parent");
            var b = a.querySelector("video"),
                c = a.querySelector(".gi-video__button"),
                d = a.querySelector(".gi-video__audio-anim");
            c.classList.remove("hidden");
            0 == b.muted && a.classList.add(
                "js-video-played");
            d && d.classList.add("hidden");
            b.controls = !1;
            giapp.curVideo = null
        });
        p && function() {
            var a =
                h.querySelector("track"),
                b = getClosestUp(a, ".gi-asset__group").querySelector(
                    ".gi-card__video-text p");
            a.addEventListener("cuechange", function(a) {
                var c = this.track.activeCues;
                0 < c.length && (b.classList.add("hide"),
                    setTimeout(function() {
                        b.innerHTML = c[0].text;
                        b.classList.remove(
                            "hide")
                    }, 250))
            }, !1)
        }()
    })();
    objectFitVideos()
};
giapp.setSocial = function() {
    var c = window.location.href.split("?")[0].split("#")[0],
        b = document.querySelector("#gi-share"),
        a = document.querySelector("#template-social").innerHTML;
    b.innerHTML += a.replace("{{tw_url}}", c).replace("{{fb_url}}", c);
    (c = document.querySelectorAll(".js-gi-share")) && [].forEach.call(c,
        function(a) {
            a.addEventListener("click", function(a) {
                a.preventDefault();
                giapp.windowPopup(this.href, 600, 620)
            })
        })
};
giapp.interactiveTracking = function(c) {
    //TODO
/*
    gi_analytics && "undefined" !== typeof s && (s.linkTrackVars = "prop16",
        s.linkTrackEvents = "", s.tl(!0, "o", c))
        */
};
giapp.windowPopup = function(c, b, a) {
    window.open(c, "",
        "menubar=no,toolbar=no,resizable=yes,scrollbars=yes,width=" + b +
        ",height=" + a + ",top=" + (screen.height / 2 - a / 2) +
        ",left=" + (screen.width / 2 - b / 2))
};
window.isMobileAndTablet = function() {
    return /Mobi/.test(navigator.userAgent) ? !0 : !1
};
var getClosestUp = function(c, b) {
        for (var a = b.charAt(0); c && c !== document; c = c.parentNode)
            if ("." === a && c.classList.contains(b.substr(1)) || "#" === a &&
                c.id === b.substr(1) || "[" === a && c.hasAttribute(b.substr(1,
                    b.length - 2)) || c.tagName.toLowerCase() === b) return c;
        return !1
    },
    getChildIndex = function(c) {
        for (var b = c.parentNode, a = b.children.length - 1; 0 <= a && c != b.children[
                a]; a--);
        return a
    };
Handlebars.registerHelper("ifeq", function(c, b, a) {
    return c == b ? a.fn(this) : a.inverse(this)
});
Handlebars.registerHelper("ifnoteq", function(c, b, a) {
    return c != b ? a.fn(this) : a.inverse(this)
});
var VHChromeFix = function(c) {
    var b = this,
        a = navigator.userAgent.toLowerCase(),
        d = /chrome/.test(a) && /android/.test(a);
    a = /crios/.test(a);
    if (d || a) this.getElements(c), this.fixAll(), this.windowWidth =
        window.innerWidth, this.windowHeight = window.innerHeight, window.addEventListener(
            "resize",
            function() {
                b.windowWidth !== window.innerWidth && b.windowHeight !==
                    window.innerHeight && (b.windowWidth = window.innerWidth,
                        b.windowHeight = window.innerHeight, b.fixAll())
            })
};
VHChromeFix.prototype.getElements = function(c) {
    this.elements = [];
    c = this.isArray(c) ? c : [c];
    for (var b = 0; b < c.length; b++)
        for (var a = document.querySelectorAll(c[b].selector), d = 0; d < a
            .length; d++) this.elements.push({
            domElement: a[d],
            vh: c[b].vh
        })
};
VHChromeFix.prototype.isArray = function(c) {
    return "[object Array]" === Object.prototype.toString.call(c)
};
VHChromeFix.prototype.fixAll = function() {
    for (var c = 0; c < this.elements.length; c++) {
        var b = this.elements[c];
        b.domElement.style.marginBottom = window.innerHeight * b.vh / 100 +
            "px"
    }
};

