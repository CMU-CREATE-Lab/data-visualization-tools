//worker.js
importScripts("../../js/seedrandom.min.js");
importScripts("../../js/gl-matrix-min.js");

importScripts("subregions.js");

var getSubRegion = function(iso) {
    return ISO_TO_SUBREGION[iso];s
}

self.addEventListener('message', function(e) {
    var year = e.data['year'];
    var code = e.data["code"];
    var scale = e.data["scale"];
    var exporters = e.data["exporters"];
    var importers = e.data["importers"];
    var rootUrl = e.data['rootUrl'];
    var setDataFnc = e.data['setDataFnc'];
    getJson(rootUrl, code, year, exporters, importers, scale, setDataFnc, function(code, year, error, exporters, importers, scale, setDataFnc, data) {
        if (error) {
            self.postMessage({error:true, year: year, code: code});
        } else {
            if (setDataFnc == "setData2") {
                var float32Array = setData2(code, year, exporters, importers, scale, data);
            } else {
                var float32Array = setData(code, year, exporters, importers, scale, data);
            }
            self.postMessage({error:false, array: float32Array.buffer, year: year, code: code, scale: scale}, [float32Array.buffer]);
        }
    });

}, false);

var getJson = function(rootUrl, code, year, exporters, importers, scale, setDataFnc, callback) {
    var url = rootUrl + '/'+ code + '/' + year + '.json';
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.onload = function() {
        try {
            var data = JSON.parse(this.responseText);
            callback(code, year, false, exporters, importers, scale, setDataFnc, data);
	    } catch(e) {
            console.log(e);
            console.log('sitc4r2: Error parsing JSON from ' + url);
            callback(code, year, true, null, null, null, null, null); 
	   }	  
    }
    xhr.error = function() {
        callback(code, year, true, null, null, null, null, null); 
    }
    xhr.send();
}

var setData = function(code, year, exporters, importers, scale, data) {
    var prng = new Math.seedrandom('sitc4r2.' + code);
    function shuffle (array) {
        var i = 0
        , j = 0
        , temp = null

        for (i = array.length - 1; i > 0; i -= 1) {
            j = Math.floor(prng() * (i + 1))
            temp = array[i]
            array[i] = array[j]
            array[j] = temp
        }
    }

    function getRandomIntInclusive(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(prng() * (max - min + 1)) + min; //The maximum is inclusive and the minimum is inclusive
    }
    function getRandomArbitrary(min, max) {
        return prng() * (max - min) + min;
    }
    function conditionCheck(row) {
        // Show all exporters and importers
        if (exporters.length == 0 && importers.length == 0) {
            return true;
        }
        // Filter by exporters
        if (exporters.length > 0 && importers.length == 0) {
            return exporters.indexOf(row["org"]) >= 0;
        }
        // Filter by importers
        if (importers.length > 0 && exporters.length == 0) {
            return importers.indexOf(row["dst"]) >= 0;
        }
        // Filter by exporters and importers
        if (exporters.length > 0 && importers.length > 0) {
            return exporters.indexOf(row["org"]) >= 0 && importers.indexOf(row["dst"]) >= 0;
        }

    }
    function doSomething(year, scale, data) {
        var points = [];
        var startDateMin = new Date((year - 1).toString() + '-01-01').getTime()/1000.;
        //var startDateMin = new Date(year.toString() + '-1-1').getTime()/1000.;
        var startDateMax = new Date(year.toString() + '-11-01').getTime()/1000.;
        var endDateMin = new Date(year.toString() + '-01-31').getTime()/1000.;
        var endDateMax = new Date(year.toString() + '-12-31').getTime()/1000.;

        for (var i = 0; i < data.length; i++) {
            if (conditionCheck(data[i])) {
                for (var j = 0; j < data[i]['export_val']/scale; j++) {
                    var start_epoch = getRandomIntInclusive(startDateMin, startDateMax);
                    var end_epoch = getRandomIntInclusive(endDateMin, endDateMax);
                    if (start_epoch > end_epoch) {
                        var temp = end_epoch;
                        end_epoch = start_epoch;
                        start_epoch = temp;
                    }

                    var val = data[i]['export_val']/scale;
                    var max_offset = Math.log(val);

                    var offset = getRandomArbitrary(0.5,max_offset);

                    var m = (data[i]['dst_wm'][1]- data[i]['org_wm'][1])/(data[i]['dst_wm'][0]- data[i]['org_wm'][0]);
                    var d =  data[i]["mid_offset"][0] != data[i]["mid_offset"][0] ? data[i]["mid_offset"][0] : data[i]["mid_offset"][1];
                    var x = data[i]['mid_wm'][0] + d*(1/(Math.sqrt(1+Math.pow(m,2))));
                    var y = data[i]['mid_wm'][1] + d*(m/(Math.sqrt(1+Math.pow(m,2))));

                    points.push(data[i]['org_wm'][0]);
                    points.push(data[i]['org_wm'][1]);
                    points.push(data[i]['dst_wm'][0]);
                    points.push(data[i]['dst_wm'][1]);
                    if (j < 10) {
                        offset = getRandomArbitrary(0.01, 1.00);
                    } else if (i < 100) {
                        offset = getRandomArbitrary(1.0, 2.00);
                    } else {
                        offset = getRandomArbitrary(2.0, 5.0);
                    }

                    points.push(x + offset);
                    points.push(y + offset);
//                    points.push(data[i]['mid_wm'][0] + data[i]["mid_offset"][0] * offset);
//                    points.push(data[i]['mid_wm'][1] + data[i]["mid_offset"][1] * offset);
                    points.push(start_epoch);
                    points.push(end_epoch);
                }
            }
        }
        return points;
    }

    var t0 = performance.now();
    var points = doSomething(year, scale, data);
    var float32Array = new Float32Array(points);
    var t1 = performance.now();
    //console.log("Call to doSomething took " + (t1 - t0) + " milliseconds.");
    return float32Array;
}

var setData2 = function(code, year, exporters, importers, scale, data) {
    var prng = new Math.seedrandom('sitc4r2.' + code);
    function shuffle (array) {
        var i = 0
        , j = 0
        , temp = null

        for (i = array.length - 1; i > 0; i -= 1) {
            j = Math.floor(prng() * (i + 1))
            temp = array[i]
            array[i] = array[j]
            array[j] = temp
        }
    }

    function getRandomIntInclusive(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(prng() * (max - min + 1)) + min; //The maximum is inclusive and the minimum is inclusive
    }
    function getRandomArbitrary(min, max) {
        return prng() * (max - min) + min;
    }
    function conditionCheck(row) {
        // Show all exporters and importers
        if (exporters.length == 0 && importers.length == 0) {
            return true;
        }
        // Filter by exporters
        if (exporters.length > 0 && importers.length == 0) {
            return exporters.indexOf(row["org"]) >= 0;
        }
        // Filter by importers
        if (importers.length > 0 && exporters.length == 0) {
            return importers.indexOf(row["dst"]) >= 0;
        }
        // Filter by exporters and importers
        if (exporters.length > 0 && importers.length > 0) {
            return exporters.indexOf(row["org"]) >= 0 && importers.indexOf(row["dst"]) >= 0;
        }

    }

    function doSomething(year, scale, data) {
        var points = [];
        var startDateMin = new Date((year - 1).toString() + '-1-1').getTime()/1000.;
        //var startDateMin = new Date(year.toString() + '-1-1').getTime()/1000.;
        var startDateMax = new Date((year - 1).toString() + '-12-31').getTime()/1000.;
        var endDateMin = new Date(year.toString() + '-1-1').getTime()/1000.;
        var endDateMax = new Date(year.toString() + '-12-31').getTime()/1000.;

        for (var i = 0; i < data.length; i++) {
            if (conditionCheck(data[i])) {
                for (var j = 0; j < data[i]['export_val']/scale; j++) {
                    var start_epoch = getRandomIntInclusive(startDateMin, startDateMax);
                    var end_epoch = getRandomIntInclusive(endDateMin, endDateMax);
                    if (start_epoch > end_epoch) {
                        var temp = end_epoch;
                        end_epoch = start_epoch;
                        start_epoch = temp;
                    }

                    var org_subregion = getSubRegion(data[i]["org"]);
                    var dst_subregion = getSubRegion(data[i]["dst"]);
                    var org = glMatrix.vec2.fromValues(data[i]['org_wm'][0], data[i]['org_wm'][1]);
                    var dst = glMatrix.vec2.fromValues(data[i]['dst_wm'][0], data[i]['dst_wm'][1]);
                    var mid = glMatrix.vec2.create();
                    glMatrix.vec2.lerp(mid,org,dst,0.5)

                    points.push(org[0]);
                    points.push(org[1]);
                    points.push(dst[0]);
                    points.push(dst[1]);

                    if (org_subregion == dst_subregion) {
                        var off = glMatrix.vec2.create();
                        var v = getRandomArbitrary(0.6, 0.62);
                        glMatrix.vec2.lerp(off,org,dst,v);
                        var c = 1.5708;                            
                        glMatrix.vec2.rotate(mid, off, mid, c)
                    } else if ((org[0] < 106.25 && dst[0] > 106.25) || (dst[0] < 106.25 && org[0] > 106.25)) {
                        var p_t05 = glMatrix.vec2.create();
                        var y_step = 12;

                        for (var ii = 0; ii < y_step; ii++) {
                            if (mid[1] > 255/y_step* ii && mid[1] < 255/y_step * (ii+1)) {
                                mid[1] = 255/y_step * ii;
                                break;
                            }
                        }
                        var a = glMatrix.vec2.create();
                        glMatrix.vec2.scale(a, mid,2);
                        var b = glMatrix.vec2.create();
                        glMatrix.vec2.scale(b, org, -0.5);
                        var c = glMatrix.vec2.create();
                        glMatrix.vec2.scale(c, dst, -0.5);
                        glMatrix.vec2.add(mid, a,b);
                        glMatrix.vec2.add(mid,mid,c);
                        var off = glMatrix.vec2.create();
                        var v = getRandomArbitrary(0.6, 0.61);
                        glMatrix.vec2.lerp(off,org,dst, v);
                        var c = 1.5708;                            
                        glMatrix.vec2.rotate(mid, off, mid, c)                        
                    } else {
                        var off = glMatrix.vec2.create();
                        var v = getRandomArbitrary(0.6, 0.62);
                        glMatrix.vec2.lerp(off,org,dst, v);
                        var c = 1.5708;                            
                        glMatrix.vec2.rotate(mid, off, mid, c)                        
                    }
                    points.push(mid[0]);
                    points.push(mid[1]);
                    points.push(start_epoch);
                    points.push(end_epoch);                        
                    points.push(data[i]["a_alpha"]);                        
                }
            }
        }
        return points;
    }

    var t0 = performance.now();
    var points = doSomething(year, scale, data);
    var float32Array = new Float32Array(points);
    var t1 = performance.now();
    //console.log("Call to doSomething took " + (t1 - t0) + " milliseconds.");
    return float32Array;
}
