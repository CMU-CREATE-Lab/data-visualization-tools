//worker.js
self.addEventListener('message', function(e) {
    var year = e.data['year'];
    var code = e.data["code"];
    var scale = e.data["scale"];
    var exporters = e.data["exporters"];
    var importers = e.data["importers"];
    getJson(code, year, exporters, importers, scale, function(code, year, exporters, importers, scale, data) {
        var float32Array = setData(code, year, exporters, importers, scale, data);
        self.postMessage({'array': float32Array.buffer, 'year': year, 'code': code, 'scale': scale}, [float32Array.buffer]);        
    });

}, false);

var getJson = function(code, year, exporters, importers, scale, callback) {
    var url = "https://tiles.earthtime.org" + '/sitc4r2/'+ code + '/' + year + '.json';    
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.onload = function() {
        var data = JSON.parse(this.responseText);
        callback(code, year, exporters, importers, scale, data);
    }
    xhr.send();

}

var setData = function(code, year, exporters, importers, scale, data) {
    function shuffle (array) {
        var i = 0
        , j = 0
        , temp = null

        for (i = array.length - 1; i > 0; i -= 1) {
            j = Math.floor(Math.random() * (i + 1))
            temp = array[i]
            array[i] = array[j]
            array[j] = temp
        }
    }

    function getRandomIntInclusive(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min; //The maximum is inclusive and the minimum is inclusive 
    }
    function getRandomArbitrary(min, max) {
        return Math.random() * (max - min) + min;
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
        var startDateMax = new Date(year.toString() + '-11-1').getTime()/1000.;
        var endDateMin = new Date(year.toString() + '-1-31').getTime()/1000.;
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
