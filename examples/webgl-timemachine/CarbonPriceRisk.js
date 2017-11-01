//CarbonPriceRisk.js
console.log("CarbonPriceRisk.js");
function CarbonPriceRisk() {
    this.scalingFunction = 'd3.scaleSqrt().domain([0, this.values["max"]*.5]).range([0, 100])';

    this.values = {
        'max' : 0,
        'min' : 1e6
    }
   
    this.years = {
        'start': 2017,
        'end': 2050
    };

    this.sectors = [
        { key: 'automobiles', value: 'Automobile manufacturing' },
        { key: 'chemicals', value: 'Chemicals' },
        { key: 'construction', value: 'Construction Materials' },
        { key: 'electric', value: 'Electric Utilities' },
        { key: 'mining', value: 'Mining' },
        { key: 'pharmaceuticals', value: 'Pharmaceuticals' },
        { key: 'telecommunications', value: 'Telecommunications' }
    ];            

    this.levels = [
        { key: 'low', value: 'Low' },
        { key: 'medium', value: 'Medium' },
        { key: 'high', value: 'High' }
    ];

    this.regions = [
        { key: 'americas', value:'Americas' }, 
        { key: 'asia', value: 'Asia-Pacific' },
        { key: 'emea', value: 'EMEA' }
    ];
};

CarbonPriceRisk.prototype.getValue = function(rawVal) {
   return parseFloat(rawVal);
}

CarbonPriceRisk.prototype.setMinMaxValue = function(val) {
    if (val > this.values['max']) {
        this.values['max'] = val;
    }
    if (val < this.values['min']) {
        this.values['min'] = val;
    }
}


CarbonPriceRisk.prototype.getIndexByKey = function(arr, key) {
    for (var i = 0; i < arr.length; i++) {
        if (arr[i].key == key) {
            return i;
        }
    }
    return  -1;
}

CarbonPriceRisk.prototype.setRadius = function(points) {
    this._radius = eval(this.scalingFunction);
    for (var i = 0; i < points.length; i++) {
        points[i]["val1"] = this._radius(points[i]["val1"]);
        points[i]["val2"] = this._radius(points[i]["val2"]);
    }
}

CarbonPriceRisk.prototype.getPoints = function(jsondata, geojsondata) {
    // Assumes data contains "Name", "2017", ..., "2050", "Sector", "Level", "Region"
    // Sector, Level and Region are idx coded. E.g. 'Low' == 0, 'Chemicals' == 1, etc...
    var that = this;
    var points = [];
    for (var i = 0; i < jsondata['data'].length; i++) {
        var row = jsondata['data'][i];
        var name = row['Name'];
        if (name != '') {
            var centroid = that.getCentroid(name, geojsondata);
            var level = row['Level'];
            var sector = row['Sector'];
            var region = row['Region'];
            for (var j = that.years['start']; j < that.years['end'] - 1; j++) {
                var val1 = that.getValue(row[j]);
                var val2 = that.getValue(row[j + 1]);
                that.setMinMaxValue(Math.abs(val1));
                that.setMinMaxValue(Math.abs(val2));
                var epoch1 = new Date(j.toString()).getTime()/1000.;
                var epoch2 = new Date((j+1).toString()).getTime()/1000.;
                points.push({
                    'centroid': centroid,
                    'level': level,
                    'sector': sector,
                    'region': region,
                    'val1': val1,
                    'epoch1': epoch1,
                    'val2': val2,
                    'epoch2': epoch2             
                });
            }
            var span = epoch2 - epoch1;
            points.push({
                'centroid': centroid,
                'level': level,
                'sector': sector,
                'region': region,
                'val1': val2,
                'epoch1': epoch2,
                'val2': val2,
                'epoch2': epoch2 + span          
            });
        }
    };
    this.setRadius(points);
    this.sortPoints(points);
    return points;
}

CarbonPriceRisk.prototype.flattenPoints = function(points) {
    var flatPoints = [];
    for (var i = 0; i < points.length; i++) {
      flatPoints.push(points[i]["centroid"][0]);
      flatPoints.push(points[i]["centroid"][1]);
      flatPoints.push(points[i]["epoch1"]);
      flatPoints.push(points[i]["val1"]);
      flatPoints.push(points[i]["epoch2"]);
      flatPoints.push(points[i]["val2"]);
      flatPoints.push(points[i]["level"]);
      flatPoints.push(points[i]["sector"]);
      flatPoints.push(points[i]["region"]);
    }
    return flatPoints;
}

CarbonPriceRisk.prototype.sortPoints = function(points) {
    points.sort(function (a, b) {
        return Math.abs(b["val2"]) - Math.abs(a["val2"]);
    });
}

CarbonPriceRisk.prototype.getCentroid = function(name, geojsondata) {
    var proj = new org.gigapan.timelapse.MercatorProjection(
        -180, 85.05112877980659, 180, -85.05112877980659,
        256, 256);
    var feature = searchCountryList(geojsondata, name);
    var latlng = { 
        lat: feature['geometry']['coordinates'][1], 
        lng:feature['geometry']['coordinates'][0]
    };
    var xy = proj.latlngToPoint(latlng);
    return [xy.x, xy.y];
}

var carbonPriceRisk = new CarbonPriceRisk();
console.log(carbonPriceRisk);