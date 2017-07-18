/**
  Dependencies:
    * CanvasJS
    * jQuery
**/

"use strict";

var CsvDataGrapher = function CsvDataGrapher() {
  this.dataLayers = {};
  this.colors = {};
  this.chart = {};
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
      /* TODO: Don't hardcode this date format */
			valueFormatString: "YYYY-MM"
		},
		toolTip: {
			shared: true,
      borderColor: "black"
		},
		axisY: {
			gridColor: "silver",
			tickColor: "silver"
		},
		data: [],
		legend: {
			cursor: "pointer",
			verticalAlign: "center",
			horizontalAlign: "left",
      fontSize: 14,
      itemWidth: 155,
      fontFamily: "Arial",
      itemclick: function (e) {
        // Toggle on/off from the legend
        if (typeof (e.dataSeries.visible) === "undefined" || e.dataSeries.visible) {
          e.dataSeries.visible = false;
          // Setting to null will prevent the name from showing in the tooltip on hover.
          e.dataSeries.toolTipContent = null;
        }	else {
          e.dataSeries.visible = true;
          // Setting to undefined will allow the name to be shown in the tooltip on hover.
          e.dataSeries.toolTipContent = undefined;
        }
        that.chart.render();
      }
	  }
  });
  timelapse.addTimeChangeListener(function(t) {
    var currentCaptureTime = timelapse.getCurrentCaptureTime();
    var captureTimeSplit = currentCaptureTime.split("-");
    that.chart.options.axisX.stripLines[0].value = new Date(captureTimeSplit[0], parseInt(captureTimeSplit[1]) - 1, 0);
    that.chart.render();
  });
};

CsvDataGrapher.prototype.loadData = function loadData(jsonUrl, callback) {
  var that = this;

  $.ajax({
    url: jsonUrl,
    dataType: "json"
  }).done(function(data) {
    that.dataLayers = data.layers;
    that.colors = data.colors;
    if (typeof(callback) === "function") {
      callback();
    }
  });
};

CsvDataGrapher.prototype.graphDataForLayer = function graphDataForLayer(layerName) {
  var that = this;
  var layer = this.dataLayers[layerName];

  if (!layer) {
    console.log("Error. Graphing unavailable for this layer: " + layerName + " Check layer name.");
    return;
  }

  var layerData = layer.data;
  var layerTitle = layer.title;

  this.chart.options.data = [];

  for (var entryName in layerData) {
    var markerType = "circle";
    var initialVisibility = false;
    var initialToolTipContent = null;
    /* TODO: How to handle special cases? */
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
      color: that.colors[entryName],
      dataPoints: that.loadRowData(layerData[entryName]),
      visible: initialVisibility
    });
  }
  this.chart.options.title.text = layerTitle;
  $("#csvChartContainer").show();
  $("#presentation-slider-selection").hide();
  $(".presentationSlider").hide();
  $("#timeMachine").addClass("layerGraphs");
  var snaplapse = timelapse.getSnaplapseForPresentationSlider();
  if (snaplapse) {
    snaplapse.getSnaplapseViewer().showHideSnaplapseContainer(false);
  }
  resize();

  timelapse.addTimelineUIChangeListener(function() {
    var currentCaptureTime = timelapse.getCurrentCaptureTime();
    var captureTimeSplit = currentCaptureTime.split("-");
    that.chart.options.axisX.stripLines[0].value = new Date(captureTimeSplit[0], parseInt(captureTimeSplit[1]) - 1, 0);
    that.chart.render();
  });

  this.chart.render();
};

CsvDataGrapher.prototype.loadRowData = function loadRowData(layerData) {
  var rowData = layerData;
  var arr = [];

  for (var dateString in rowData) {
    var val = rowData[dateString];
    var year = dateString.substring(0, 4);
    var month = dateString.substring(4, 6);
    var tmp = {
      x: new Date(year, month - 1, 1),
      y: val
    };
    arr.push(tmp);
  }
  return arr;
};
