var CsvFileLayer = function CsvFileLayer() {
  this.layers = [];
  this.layerAleadyLoaded;
}

CsvFileLayer.prototype.addLayer = function addLayer(nickname, url, name, credit, scalingFunction) {
  console.log('addLayer: ' + scalingFunction);
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
  var layer = new WebglVectorLayer2(glb, canvasLayer, url, layerOptions);
  this.layers.push(layer);

  var id = 'show-csv-' + nickname;
  var row = '<tr><td><label name="' + nickname + '">';
  row += '<input type="checkbox" id="' + id + '">';
  row += name;
  row += '</label></td></tr>';
  $('#other_table tr:last').after(row);

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
      scalingFunction = 'd3.scaleSqrt().domain([minValue, maxValue]).range([0, 1])';
    }

    this.addLayer(layerIdentifier, // identifier
      layerdef[2], // url
      layerdef[3], // name
      layerdef[4],
      scalingFunction); // credit

    this.setTimeLine(layerIdentifier,
      parseInt(layerdef[5], 10), // start date
      parseInt(layerdef[6], 10), // end date
      parseInt(layerdef[7], 10)); // step size
  }
}

CsvFileLayer.prototype.loadLayers = function loadLayers(docTabId) {
  if (this.layerAlreadyLoaded) {
    if (docTabId == this.layerAlreadyLoaded) return;
    // We need to reload the dotlayers, but we don't know how to do that
    // So just refresh this page instead.
    // TODO: clear the layers and reload just the layers.
    location.reload();
  }
  this.layerAlreadyLoaded = docTabId;

  var docId = docTabId.split('.')[0];
  var tabId = docTabId.split('.')[1];
  var url = 'https://docs.google.com/spreadsheets/d/' + docId + '/edit';
  if (tabId) {
      url += '#gid=' + tabId;
  }
  var that = this;
  org.gigapan.Util.gdocToJSON(url, function(tsvdata) {
    that.loadLayersFromTsv(tsvdata);
  });

}

CsvFileLayer.prototype.setTimeLine = function setTimeLine(identifier, startDate, endDate, step) {
  var captureTimes = [];
  if (isNaN(startDate) || isNaN(endDate) || isNaN(step) ) {
    captureTimes = cached_ajax['landsat-times.json']['capture-times'];
  } else {
    for (var i = startDate; i < endDate + 1; i+=step) {
      captureTimes.push(i.toString());
    }

  }
  cached_ajax[identifier + '.json'] = {"capture-times":  captureTimes};
}

var COUNTRY_LIST = null;
var xhr = new XMLHttpRequest();
xhr.open('GET', "gapminder.geojson");
xhr.onload = function() {
    COUNTRY_LIST = JSON.parse(this.responseText);
}
xhr.send();

function searchCountryList(name) {
  for (var i = 0; i < COUNTRY_LIST['features'].length; i++) {
    var feature = COUNTRY_LIST['features'][i];
    if (name == feature['properties']['gapminder_name'] || name == feature['properties']['gapminder_geo'] || name == feature['properties']['iso_3136']) {
      return feature['properties']['webmercator'];
    }
  }
  return ['',''];
}

