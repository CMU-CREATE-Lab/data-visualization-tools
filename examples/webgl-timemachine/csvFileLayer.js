var CsvFileLayer = function CsvFileLayer() {
  this.layers = [];
  this.dataLoadedListeners = [];
  this.layersData = {};
}


CsvFileLayer.prototype.addLayer = function addLayer(opts) {
  // (someday) Use csv.createlab.org as translation gateway
  // url = 'http://csv.createlab.org/' + url.replace(/^https?:\/\//,'')

  var nickname = opts["nickname"];
  var url = opts["url"];
  var name = opts["name"];
  var credit = opts["credit"];
  var scalingFunction = opts["scalingFunction"];
  var mapType = opts["mapType"];
  var color = opts["color"];
  var legendContent = opts["legendContent"];
  var externalGeojson = opts["externalGeojson"];

  var layerOptions = {
    tileWidth: 256,
    tileHeight: 256,
    nLevels: 0,
    scalingFunction: scalingFunction,
    layerId: nickname,
    loadDataFunction: WebGLVectorTile2.prototype._loadBubbleMapDataFromCsv,
    dataLoadedFunction: this.dataLoadedFromCsv.bind(this),
    setDataFunction: WebGLVectorTile2.prototype._setBubbleMapData,
    drawFunction: WebGLVectorTile2.prototype._drawBubbleMap,
    fragmentShader: WebGLVectorTile2.bubbleMapFragmentShader,
    vertexShader: WebGLVectorTile2.bubbleMapVertexShader,
    externalGeojson: externalGeojson
  };
  if (mapType == "choropleth") {
    layerOptions.loadDataFunction = WebGLVectorTile2.prototype._loadChoroplethMapDataFromCsv;
    layerOptions.setDataFunction = WebGLVectorTile2.prototype._setChoroplethMapData;
    layerOptions.drawFunction = WebGLVectorTile2.prototype._drawChoroplethMap;
    layerOptions.fragmentShader = WebGLVectorTile2.choroplethMapFragmentShader;
    layerOptions.vertexShader = WebGLVectorTile2.choroplethMapVertexShader;
    layerOptions.imageSrc =  "obesity-color-map.png";
  }

  var layer = new WebglVectorLayer2(glb, canvasLayer, url, layerOptions);
  layer.options = layer.options || {};
  if (color) {
    layer.options.color = color;
  }
  var re = /_paired/;
  var m = nickname.match(re)
  if (m) {
    layer.paired = true;
  } else {
    layer.paired = false;
  }

  layer.opts = opts;
  this.layers.push(layer);

  var id = 'show-csv-' + nickname;
  var row = '<tr><td><label name="' + nickname + '">';
  row += '<input type="checkbox" id="' + id + '">';
  row += name;
  row += '</label></td></tr>';

  $('#csvlayers_table').append(row);

  // Create and insert legend
  var legend='<tr id="' + nickname + '-legend" style="display: none"><td>';
  legend += '<div style="font-size: 18px">' + name
  if (credit) legend += '<span class="credit">(' + credit + ')</span>';
  legend += '</div>';
  legend += legendContent;
  legend += '<div style="float: left; padding-right:8px">';

  /* TODO -- Add columnDefs
  for (var i = 0; i < columnDefs.length; i++) {
    legend += '<div style="float: left; padding-right:8px">'
    legend += '<div style="background-color:' + columnDefs[i].color + '; width: 12px; height: 12px; float: left; margin-top: 2px; margin-left: 8px;"></div>';
    legend += '&nbsp;' + columnDefs[i].name + '</div>'
  }
  */
  legend += '</div>';
  legend += '</td></tr>';
  $('#legend-content table tr:last').after(legend);

  // Handle click event to turn on and off layer
  $('#' + id).on("click", function() {
    if ($(this).prop('checked')) {
      // Turn on layer
      setActiveLayersWithTimeline(1);
      timelineType = "defaultUI";
      requestNewTimeline(nickname + ".json", timelineType);
      if (visibleBaseMapLayer != "dark") {
        $("#dark-base").click();
      }
      layer.visible = true;
      $("#" + nickname + "-legend").show();

    } else {
      // Turn off layer
      layer.visible = false;
      $("#" + nickname + "-legend").hide();
      setActiveLayersWithTimeline(-1);
      doSwitchToLandsat();
    }
  }).prop('checked', layer.visible);
}


CsvFileLayer.prototype.addDataLoadedListener = function addDataLoadedListener(listener) {
  if (typeof(listener) === "function") {
    this.dataLoadedListeners.push(listener);
  }
};


CsvFileLayer.prototype.removeDataLoadedListener = function removeDataLoadedListener(listener) {
  for (var i = 0; i < this.dataLoadedListeners.length; i++) {
    if (this.dataLoadedListeners[i] == listener) {
      this.dataLoadedListeners.splice(i, 1);
      break;
    }
  }
};


CsvFileLayer.prototype.dataLoadedFromCsv = function dataLoadedFromCsv(layerId) {
  for (var i = 0; i < this.dataLoadedListeners.length; i++) {
    this.dataLoadedListeners[i](layerId);
  }
};


CsvFileLayer.prototype.loadLayersFromTsv = function loadLayersFromTsv(layerDefinitions) {
  var that = this;

  that.layersData = Papa.parse(layerDefinitions, {delimiter: "\t", header: true});

  for (var i =  0; i < that.layersData['data'].length; i++) {
    var layer = that.layersData['data'][i];
    if (layer["Enabled"]) {
      var layerIdentifier = layer["Share link identifier"].replace(/\W+/g, '_');

      var scalingFunction = layer["Scaling"].trim();
      if (scalingFunction == '') {
        scalingFunction = 'd3.scaleSqrt().domain([minValue, maxValue]).range([0, 100])';
      }

      var mapType = layer["Map Type"].trim();
      if (mapType != "bubble" && mapType != "choropleth") {
        mapType = "bubble";
      }

      var optionalColor = layer["Color"].trim();
      if (optionalColor) {
        optionalColor = JSON.parse(optionalColor);
      }

      var legendContent = "";
      if (typeof layer["Legend Content"] != "undefined") {
        legendContent = layer["Legend Content"].trim();
        if (legendContent == "auto") {
          if (mapType == "bubble") {
            legendContent = BUBBLE_MAP_LEGEND_TMPL.replace(/TMPL_ID/,layerIdentifier + '-svg' );
          } else {
            legendContent = CHOROPLETH_LEGEND_TMPL;
          }
        }
      }



      var externalGeojson = "";
      if (typeof layer["External GeoJSON"] != "undefined") {
        externalGeojson = layer["External GeoJSON"].trim()
      }

      var opts = {
        nickname: layerIdentifier,
        url: layer["URL"],
        name: layer["Name"],
        credit: layer["Credits"],
        scalingFunction: scalingFunction,
        mapType: mapType,
        color: optionalColor,
        legendContent: legendContent,
        externalGeojson: externalGeojson
      }

      this.addLayer(opts);
      this.setTimeLine(layerIdentifier,
        layer["Start date"], // start date
        layer["End date"], // end date
        layer["Step"]); // step size
    }

  }
};

CsvFileLayer.prototype.loadLayers = function loadLayers(path) {
  if (path == csvlayersLoadedPath) return;
  csvlayersLoadedPath = path;
  var url = path;

  var that = this;

  // Clear out any csv layers that have already been loaded
  $("#csvlayers_table").find("input:checked").trigger("click");
  $('#csvlayers_table').empty();
  that.layers = [];

  if (path.indexOf(".tsv") != -1) {
    // Load local version of the csv .tsv file
    $.ajax({
      url: path,
      dataType: "text",
      success: function(csvdata) {
        that.loadLayersFromTsv(tsvdata);
      }
    });
    return;
  } else if (path.indexOf("http") != 0) {
    var docId = path.split('.')[0];
    var tabId = path.split('.')[1];
    url = 'https://docs.google.com/spreadsheets/d/' + docId + '/edit';
    if (tabId) {
      url += '#gid=' + tabId;
    }
  }
  org.gigapan.Util.gdocToJSON(url, function(tsvdata) {
    that.loadLayersFromTsv(tsvdata);
  });
};


CsvFileLayer.prototype.setTimeLine = function setTimeLine(identifier, startDate, endDate, step) {
  var captureTimes = [];

  var yyyymm_re = /(\d{4})(\d{2})$/;
  var sm = startDate.match(yyyymm_re);
  var em = endDate.match(yyyymm_re);
  if (sm && em) {
    var startYear = sm[1];
    var startMonth = sm[2];
    var endYear = em[1];
    var endMonth = em[2];
    startYear = parseInt(startYear, 10);
    startMonth = parseInt(startMonth, 10);
    endYear = parseInt(endYear, 10);
    endMonth = parseInt(endMonth, 10);


    if (isNaN(startYear) || isNaN(endYear) || isNaN(startMonth) || isNaN(endMonth) ) {
      captureTimes = cached_ajax['landsat-times.json']['capture-times'];
    } else {
      function pad(n) {
        return (n < 10) ? ("0" + n) : n;
      }
      for (var i = startYear; i <= endYear; i++) {
        var beginMonth = 1;
        var stopMonth = 12;
        if (i == startYear) {
          beginMonth = startMonth;
        }
        if (i == endYear) {
          stopMonth = endMonth;
        }
        for (var j = beginMonth; j <= stopMonth; j++) {
          captureTimes.push(pad(i.toString()) + "-" + pad(j.toString()));
        }
      }
    }
  } else  {
    startDate = parseInt(startDate,10);
    endDate = parseInt(endDate,10);
    step = parseInt(step,10);
    if (isNaN(startDate) || isNaN(endDate) || isNaN(step) ) {
      captureTimes = cached_ajax['landsat-times.json']['capture-times'];
    } else {
      for (var i = startDate; i < endDate + 1; i+=step) {
        captureTimes.push(i.toString());
      }

    }

  }
  cached_ajax[identifier + '.json'] = {"capture-times":  captureTimes};
};

CsvFileLayer.prototype.updateCsvFileLayerLegend = function updateCsvFileLayerLegend(layerId) {
  for (var i = 0; i < this.layers.length; i++) {
    if (this.layers[i]['_layerId'] == layerId) {
      if (this.layers[i]['opts']['mapType'] == 'bubble' && this.layers[i]['opts']['legendContent'] != '') {
        var radius = this.layers[i]['_tileView']['_tiles']['000000000000000']['_radius'];
        var values = {
          '50PX_BMLT': radius.invert(50),
          '80PX_BMLT': radius.invert(80),
          '100PX_BMLT': radius.invert(100)
        }
        var el = document.getElementById(layerId + '-svg');
        for (var j = 0; j < el.children.length;j++) {
          var child = el.children[j];
          if (child.innerHTML == "50PX_BMLT") {
            child.innerHTML = child.innerHTML.replace(/50PX_BMLT/,values['50PX_BMLT']);          
          }
          if (child.innerHTML == "80PX_BMLT") {
            child.innerHTML = child.innerHTML.replace(/80PX_BMLT/,values['80PX_BMLT']);          
          }
          if (child.innerHTML == "100PX_BMLT") {
            child.innerHTML = child.innerHTML.replace(/100PX_BMLT/,values['100PX_BMLT']);          
          }
        }
      }
      break;
    }

  }
};

var BUBBLE_MAP_LEGEND_TMPL = 
  '<svg id="TMPL_ID" class="svg-legend" width="200" height="180">\n' +
  '<!--<circle class="gain" r="10" cx="15" cy="10" style="fill: green; stroke: #fff;"></circle> \n' +
  '<text x="30" y="15">Total population</text>--> \n' +
  '<circle r="25.0" cx="120.0" cy="115.0" vector-effect="non-scaling-stroke" style="fill: none; stroke: #999"></circle>\n' +
  '<circle r="40.0" cx="120.0" cy="100.0" vector-effect="non-scaling-stroke" style="fill: none; stroke: #999"></circle>\n' +
  '<circle r="50.0" cx="120.0" cy="90.0" vector-effect="non-scaling-stroke" style="fill: none; stroke: #999"></circle>\n' +
  '<text text-anchor="middle" x="120.0" y="105.0" dy="13" style="font-size: 12px; fill: #666">50PX_BMLT</text>\n' +
  '<text text-anchor="middle" x="120.0" y="70.0" dy="13" style="font-size: 12px; fill: #666">80PX_BMLT</text>\n' +
  '<text text-anchor="middle" x="120.0" y="45.0" dy="13" style="font-size: 12px; fill: #666">100PX_BMLT</text>\n' +
  '</svg>\n';

var CHOROPLETH_LEGEND_TMPL = 
  '<svg class="svg-legend" width="240" height="40">\n' +
  '<text x="30" y="12">Total capacity in GWh</text>\n' +
  '<rect fill="#ffffff" x="0"   y="15" height="10" width="25"></rect>\n' +
  '<rect fill="#fff18e" x="25"  y="15" height="10" width="25"></rect>\n' +
  '<rect fill="#ffdc5b" x="50"  y="15" height="10" width="25"></rect>\n' +
  '<rect fill="#ffc539" x="75"  y="15" height="10" width="25"></rect>\n' +
  '<rect fill="#ffad21" x="100"  y="15" height="10" width="25"></rect>\n' +
  '<rect fill="#ff920c" x="125" y="15" height="10" width="25"></rect>\n' +
  '<rect fill="#ff7500" x="150" y="15" height="10" width="25"></rect>\n' +
  '<rect fill="#ff5000" x="175" y="15" height="10" width="25"></rect>\n' +
  '<rect fill="#ff0000" x="200" y="15" height="10" width="25"></rect>\n' +
  '<text font-size="11px" fill="rgba(0, 0, 0, 1.0)" y="35" x="12">0</text>\n' +
  '<text font-size="11px" fill="rgba(0, 0, 0, 1.0)" y="35" x="103">38K</text>\n' +
  '<text font-size="11px" fill="rgba(0, 0, 0, 1.0)" y="35" x="203">77K</text>\n' +
  '</svg>\n';

var COUNTRY_CENTROIDS = null;
var xhr = new XMLHttpRequest();
xhr.open('GET', "gapminder.geojson");
xhr.onload = function() {
    COUNTRY_CENTROIDS = JSON.parse(this.responseText);
}
xhr.send();


var COUNTRY_POLYGONS = null;
var xhr = new XMLHttpRequest();
xhr.open('GET', "country_polygons.geojson");
xhr.onload = function() {
    COUNTRY_POLYGONS = JSON.parse(this.responseText);
}
xhr.send();


function searchCountryList(feature_collection, name) {
  for (var i = 0; i < feature_collection['features'].length; i++) {
    var feature = feature_collection['features'][i];
    var names = feature['properties']['names'];
    for (var j = 0; j < names.length; j++) {
      if (name == names[j]) {
        //return feature['properties']['webmercator'];
        return feature;
      }
    }
  }
  return {};
};
