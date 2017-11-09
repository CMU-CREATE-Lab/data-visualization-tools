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
        { key: 'automobiles', value: 'Automobile manufacturing', selected: false },
        { key: 'chemicals', value: 'Chemicals', selected: false },
        { key: 'construction', value: 'Construction Materials', selected: false },
        { key: 'electric', value: 'Electric Utilities', selected: false },
        { key: 'mining', value: 'Mining', selected: false },
        { key: 'pharmaceuticals', value: 'Pharmaceuticals', selected: false },
        { key: 'telecommunications', value: 'Telecommunications', selected: false }
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

CarbonPriceRisk.prototype.layerSelected = function() {
    for (var i = 0; i < this.sectors.length; i++) {
        if (this.sectors[i]['selected'] == true) {
            return true;
        }
    }
    return false;
}

CarbonPriceRisk.prototype.enableSelect = function(idx) {
    var key = this.sectors[idx]['key'];
    var that = this;
    $("#show-carbon-price-risk-" + key).on("click", function() {
        console.log(key);
        if ($(this).prop('checked')) {
          that.sectors[idx]['selected'] = true;
          showCarbonPriceRiskLayer = true;
          setActiveLayersWithTimeline(1);
          timelineType = "customUI";
          requestNewTimeline("carbon-price-risk-times.json", timelineType);
          $("#carbon-price-risk-legend").show();
          if (visibleBaseMapLayer != "dark") {
            $("#dark-base").click();
          }
        } else {
          that.sectors[idx]['selected'] = false;
          if (!that.layerSelected()) {
            showCarbonPriceRiskLayer = false;
            setActiveLayersWithTimeline(-1);
            doSwitchToLandsat();
            $("#carbon-price-risk-legend").hide();
           }
         
        }
    }).prop('checked', showCarbonPriceRiskLayer);
}

CarbonPriceRisk.prototype.getSelect = function(idx) {
    var str = '<td class="carbon-price-risk-select-'+ this.sectors[idx]['key'] + '">' +
              '<label for="show-carbon-price-risk-'+ this.sectors[idx]['key'] + 
              '" name="carbon_price_risk"><input type="checkbox" id="show-carbon-price-risk-' + 
              this.sectors[idx]['key'] +
              '" />' + this.sectors[idx]['value'] + '</label></td>';
    return str;
}

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