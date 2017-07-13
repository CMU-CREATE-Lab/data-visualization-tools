var CsvFileLayer = function CsvFileLayer() {
  this.layers = [];
  this.layerAleadyLoaded;
}


CsvFileLayer.prototype.addLayer = function addLayer(nickname, url, name, credit, scalingFunction, mapType, color) {
  // (someday) Use csv.createlab.org as translation gateway
  // url = 'http://csv.createlab.org/' + url.replace(/^https?:\/\//,'')
  var layerOptions = {
    tileWidth: 256,
    tileHeight: 256,
    nLevels: 0,
    scalingFunction: scalingFunction,
    loadDataFunction: WebGLVectorTile2.prototype._loadBubbleMapDataFromCsv,
    setDataFunction: WebGLVectorTile2.prototype._setBubbleMapData,
    drawFunction: WebGLVectorTile2.prototype._drawBubbleMap,
    fragmentShader: WebGLVectorTile2.bubbleMapFragmentShader,
    vertexShader: WebGLVectorTile2.bubbleMapVertexShader
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
  this.layers.push(layer);

  var id = 'show-csv-' + nickname;
  var row = '<tr><td><label name="' + nickname + '">';
  row += '<input type="checkbox" id="' + id + '">';
  row += name;
  row += '</label></td></tr>';

  $('#csvlayers_table').append(row);

  // Create and insert legend
  var legend='<tr id="' + nickname + '-legend" style="display: none"><td>';
  legend += '<div style="font-size: 17px">' + name
  if (credit) legend += '<span class="credit">(' + credit + ')</span>';
  legend += '</div>'
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
      timelineType = "customUI";
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
      timelineType = "customUI";
      requestNewTimeline(cachedLandsatTimeJsonPath, timelineType);

    }
  }).prop('checked', layer.visible);
}


CsvFileLayer.prototype.loadLayersFromTsv = function loadLayersFromTsv(layerDefinitions) {
  var layerdefs = layerDefinitions.split('\n').slice(2); // Remove column headers
  for (var i = 0; i < layerdefs.length; i++) {
    var layerdef = layerdefs[i].split('\t');
    if (layerdef[0] == 'FALSE') continue;
    var layerIdentifier = layerdef[1].replace(/\W+/g, '_'); // sanitize non-word chars
    var scalingFunction = layerdef[8].trim();
    if (scalingFunction == '') {
      scalingFunction = 'd3.scaleSqrt().domain([minValue, maxValue]).range([0, 100])';
    }
    var mapType = layerdef[9].trim();
    if (mapType != "bubble" && mapType != "choropleth") {
      mapType = "bubble";
    }

    var optionalColor = layerdef[10].trim();
    if (optionalColor) optionalColor = JSON.parse(optionalColor);

    this.addLayer(layerIdentifier, // identifier
      layerdef[2], // url
      layerdef[3], // name
      layerdef[4], // credit
      scalingFunction,
      mapType,
      optionalColor);

    this.setTimeLine(layerIdentifier,
      layerdef[5], // start date
      layerdef[6], // end date
      layerdef[7]); // step size
  }
}

CsvFileLayer.prototype.loadLayers = function loadLayers(path) {
  if (path == csvlayersLoadedPath) return;
  csvlayersLoadedPath = path;
  var url = path;

  var that = this;

  // Clear out any csv layers that have already been loaded
  $("#csvlayers_table").find("input:checked").trigger("click");
  $('#csvlayers_table').empty();

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
}


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
}

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
}

