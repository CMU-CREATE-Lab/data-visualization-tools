/**
  Dependencies:
    * CanvasJS library
    * jQuery library
    * csvFileLayer.js
    * timelapse.js
**/

"use strict";

var CsvDataGrapher = function CsvDataGrapher() {
  this.chart = {};
  this.activeLayer = {};

  // 100 distinct colors
  // TODO: Perhaps instead have colors pulled from the spreadsheet?
  this.colors = ["#610045","#8100c4","#397300","#01bc8e","#ffb363","#00c9df","#9b8100","#d2005c","#9ee2ba","#00692b","#005dd1","#9200a8","#d6f000","#605700","#fb6a00","#bfffce","#467aff","#650085","#452c00","#9a0006","#ff5b52","#66006b","#faffb2","#fffc88","#008c5d","#ffffc7","#00d75f","#00a21a","#900087","#003c6f","#004f46","#baffe3","#53eeff","#ff65f9","#ff4e7f","#a1fff7","#7d0057","#ca0031","#5b0056","#ff9dd7","#ffeeee","#ff984f","#0179bd","#acffc0","#8d8b00","#52ffbb","#ff76ef","#6acdff","#02a5fe","#ffbacb","#ff677d","#c0ffef","#a3ff96","#ff918b","#9eff6f","#0033bb","#ff468f","#7fa4ff","#a9ff5b","#abc7ff","#ff5c3b","#94004d","#d996ff","#1f2c00","#004758","#eaffe8","#681100","#01caf9","#005039","#01e08f","#01a9b5","#32ff65","#ffadfe","#ff3db8","#9e0024","#320049","#0f0011","#240024","#02c184","#ff78c8","#ff9232","#00545d","#bac800","#ffaa87","#72ff9e","#00163d","#733a00","#002669","#dbff90","#0255ff","#290016","#2a1800","#b10049","#befd06","#004208","#00600a","#e4f4ff","#b89d00","#2f4400","#490013"];
};

CsvDataGrapher.prototype.initialize = function initialize() {
  var that = this;
  this.chart = new CanvasJS.Chart("csvChartContainer", {
    title: {
      fontSize: 22
    },
    animationEnabled: false,
    zoomEnabled: true,
    zoomType: "xy",
    axisX: {
      stripLines: [{
        value: null,
        color: "red"
      }],
      gridColor: "silver",
      tickColor: "silver",
      labelFontSize: 14,
      title: "Time"
    },
    toolTip: {
      shared: true,
      borderColor: "black"
    },
    axisY: {
      margin: 150,
      labelFontSize: 14,
      gridColor: "silver",
      tickColor: "silver",
      title: "Value"
    },
    data: [],
    legend: {
      maxWidth: 0
    }
  });

  $("#csvChartLegendList").on("click", $("li"), function (e) {
    var index = $(e.target).closest("li").index();
    var $entry = $("#csv-entry-" + index);
    if (typeof (that.chart.options.data[index].visible) === "undefined" || that.chart.options.data[index].visible) {
      that.chart.options.data[index].visible = false;
      // Setting to null will prevent the name from showing in the tooltip on hover.
      that.chart.options.data[index].toolTipContent = null;
      $entry.removeClass("chartEntrySelected");
    } else {
      that.chart.options.data[index].visible = true;
      // Setting to undefined will allow the name to be shown in the tooltip on hover.
      that.chart.options.data[index].toolTipContent = undefined;
      $entry.addClass("chartEntrySelected");
    }
    that.chart.render();
  });

  var handleStripLines = function() {
    var currentCaptureTime = timelapse.getCurrentCaptureTime();
    var captureTimeSplit = currentCaptureTime.split("-");
    if (that.chart.options.axisX.valueFormatString == "YYYY-MM") {
      that.chart.options.axisX.stripLines[0].value = new Date(captureTimeSplit[0], parseInt(captureTimeSplit[1]) - 1, 1);
    } else {
      that.chart.options.axisX.stripLines[0].value = new Date(captureTimeSplit[0], 1, 0);
    }
    that.chart.render();
  };

  timelapse.addTimeChangeListener(function(t) {
    handleStripLines();
  });

  timelapse.addTimelineUIChangeListener(function() {
    handleStripLines();
  });

};


CsvDataGrapher.prototype.graphDataForLayer = function graphDataForLayer(layerName) {
  var that = this;
  var layerNameMatch = false;
  this.activeLayer = {};

  // NOTE: We rely on the global csvFileLayers variable as defined in index.html
  for (var i = 0; i < csvFileLayers.layers.length; i++) {
    if (csvFileLayers.layers[i]._layerId == layerName) {
      var tiles = csvFileLayers.layers[i]._tileView._tiles;
      var key = Object.keys(tiles)[0];
      var data = tiles[key].jsondata.data;
      var layerProps = csvFileLayers.layersData.data[i];
      var showGraph = layerProps['Show Graph'];
      if (!showGraph) return;
      that.activeLayer.title = layerProps['Graph Title'] || layerProps['Name'];
      that.getDataForLayer(data);
      layerNameMatch = true;
      break;
    }
  }

  if (!layerNameMatch) {
    console.log("Warning. Graphing unavailable for this layer: " + layerName + " Check layer name.");
    return;
  }

  this.chart.options.data = [];
  $("#csvChartLegendList").empty();
  var idx = 0;
  for (var entryName in that.activeLayer.entries) {
    var markerType = "circle";
    var initialVisibility = idx == 0 ? true : false;
    var initialToolTipContent  = idx == 0 ? undefined : null;

    // TODO: How to handle special cases?
    // TODO: Allow for different marker types in spreadsheet?
    if (entryName == "National") {
      markerType = "square";
      initialVisibility = true;
      initialToolTipContent = undefined;
    }
    that.chart.options.data.push({
      type: "line",
      click: function(e) {
        timelapse.seekToFrame(timelapse.findExactOrClosestCaptureTime(String(e.dataPoint.x)));
      },
      showInLegend: true,
      toolTipContent: initialToolTipContent,
      name: entryName,
      markerType: markerType,
      // Fallback to black if we run out of colors
      color: that.colors[idx] || "black",
      dataPoints: that.activeLayer.entries[entryName],
      visible: initialVisibility
    });
    var $lengendEntry = "<li id=csv-entry-" + idx + " style='cursor: pointer; color: " + that.chart.options.data[idx].color + ";'><span>" + entryName + "</span></div>";
    $("#csvChartLegendList").append($lengendEntry);
    if (initialVisibility) {
      $("#csv-entry-" + idx).addClass("chartEntrySelected");
    }
    idx++;
  }

  this.chart.options.title.text = this.activeLayer.title;
  this.chart.render();
};

CsvDataGrapher.prototype.getDataForLayer = function getDataForLayer(layerData) {
  var that = this;
  this.activeLayer.entries = {};

  var header = layerData[0];
  var has_lat_lon = (
    header[1].substr(0, 3).toLowerCase() == 'lat' &&
    header[2].substr(0, 3).toLowerCase() == 'lon');
  var first_data_col = has_lat_lon ? 3 : 1;

  // Times are contained in the first array
  for (var i = 1; i < layerData.length - 1; i++) {
    that.activeLayer.entries[layerData[i][0]] = [];
    var entry = that.activeLayer.entries[layerData[i][0]];
    for (var j = first_data_col; j < layerData[i].length; j++) {
      var date = header[j];
      var yyyymm_re = /(\d{4})(\d{2})$/;
      var m = date.match(yyyymm_re);
      if (m) {
        that.chart.options.axisX.valueFormatString = "YYYY-MM";
        date = new Date(m[1], m[2] - 1, 1);
      } else {
        that.chart.options.axisX.valueFormatString = "YYYY";
        date = new Date(header[j], 1, 0);
      }
      var val = parseFloat(layerData[i][j]);
      if (isNaN(val)) {
        val = 0;
      }
      entry.push({
        x: date,
        y: val
      });
    }
  }
};
