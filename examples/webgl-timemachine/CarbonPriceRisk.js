//CarbonPriceRisk.js
console.log("CarbonPriceRisk.js");
function CarbonPriceRisk() {
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

CarbonPriceRisk.prototype.getPoints = function(jsondata, geojsondata) {
    // Assumes data contains "Name", "2017", ..., "2050", "Sector", "Level", "Region"
    // Sector, Level and Region are idx coded. E.g. 'Low' == 0, 'Chemicals' == 1, etc...
    var that = this;
    var points = jsondata['data'].map(function(row) {
        var name = row['Name'];
        if (name != '') {
            var centroid = that.getCentroid(name, geojsondata);
            var level = row['Level'];
            var sector = row['Sector'];
            var region = row['Region'];
            for (var i = that.years['start']; i < that.years['end'] - 1; i++) {
                var val1 = that.getValue(row[i]);
                var val2 = that.getValue(row[i + 1]);
                that.setMinMaxValue(Math.abs(val1));
                that.setMinMaxValue(Math.abs(val2));
                var epoch1 = new Date(i.toString());
                var epoch2 = new Date((i+1).toString());
            }
            
        }
    });
    //return points;
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