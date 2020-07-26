/**
  Dependencies:
    * CanvasJS library
    * jQuery library
    * csvFileLayer.js
    * timelapse.js
**/


/// <reference path="../../timemachine/js/canvasjs/canvasjs.min.js">

import { EarthTime } from './EarthTime'
//declare var $:any;

export class CsvDataGrapher {
  activeLayer: {
    title?: string,
    entries?: {[key: string]: any[]}
  };
  colors: string[];
  chart: any;
  earthTime: EarthTime;

  constructor (earthTime: EarthTime) {
    this.earthTime = earthTime;
    this.activeLayer = {};
    this.chart = {};

    // 100 distinct colors
    this.colors = ["#610045","#8100c4","#397300","#01bc8e","#ffb363","#00c9df","#9b8100","#d2005c","#9ee2ba","#00692b","#005dd1","#9200a8","#d6f000","#605700","#fb6a00","#bfffce","#467aff","#650085","#452c00","#9a0006","#ff5b52","#66006b","#faffb2","#fffc88","#008c5d","#ffffc7","#00d75f","#00a21a","#900087","#003c6f","#004f46","#baffe3","#53eeff","#ff65f9","#ff4e7f","#a1fff7","#7d0057","#ca0031","#5b0056","#ff9dd7","#ffeeee","#ff984f","#0179bd","#acffc0","#8d8b00","#52ffbb","#ff76ef","#6acdff","#02a5fe","#ffbacb","#ff677d","#c0ffef","#a3ff96","#ff918b","#9eff6f","#0033bb","#ff468f","#7fa4ff","#a9ff5b","#abc7ff","#ff5c3b","#94004d","#d996ff","#1f2c00","#004758","#eaffe8","#681100","#01caf9","#005039","#01e08f","#01a9b5","#32ff65","#ffadfe","#ff3db8","#9e0024","#320049","#0f0011","#240024","#02c184","#ff78c8","#ff9232","#00545d","#bac800","#ffaa87","#72ff9e","#00163d","#733a00","#002669","#dbff90","#0255ff","#290016","#2a1800","#b10049","#befd06","#004208","#00600a","#e4f4ff","#b89d00","#2f4400","#490013"];
  };

  initialize() {
    var that = this;
    // @ts-ignore
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
        labelFontSize: 14
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
        includeZero: false
      },
      data: [],
      legend: {
        maxWidth: 0
      }
    });

    $("#csvChartLegendList").on("click", $("li"), function (e) {
      var index = $(e.target).closest("li").index();
      var $entry = $("#csv-entry-" + index);
      var $selectedPlots = $("#csvChartLegendList").find(".chartEntrySelected");
      // Ensure the user can cannot hide the last visible plot
      if (index == -1 || $selectedPlots.length == 1 && $selectedPlots[0] == $entry[0]) {
        return;
      }
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
      $selectedPlots = $("#csvChartLegendList").find(".chartEntrySelected");
      var title;
      if ($selectedPlots.length == 1) {
        var idx = parseInt($selectedPlots.attr("id").split("csv-entry-")[1]);
        title = that.chart.options.data[idx].layerTitle;
      } else {
        title = that.chart.options.graphGroupName;
      }
      that.activeLayer.title = title;
      that.chart.options.title.text = title;
      that.chart.render();
    });

    var handleStripLines = function() {
      var currentCaptureTime = this.earthTime.timelapse.getCurrentCaptureTime();
      if (!currentCaptureTime) return;
      var captureTimeSplit = currentCaptureTime.split("-");
      if (that.chart.options.axisX.valueFormatString == "YYYY-MM") {
        that.chart.options.axisX.stripLines[0].value = new Date(captureTimeSplit[0], parseInt(captureTimeSplit[1]) - 1, 1);
      } else {
        that.chart.options.axisX.stripLines[0].value = new Date(captureTimeSplit[0], 0, 1);
      }
      that.chart.render();
    };

    this.earthTime.timelapse.addTimeChangeListener(function() {
      if ($("#csvChartContainer").css("display") == 'none') return;
      handleStripLines();
    });

    this.earthTime.timelapse.addTimelineUIChangeListener(function() {
      if ($("#csvChartContainer").css("display") == 'none') return;
      handleStripLines();
    });

  }

  graphDataForLayer(layerId, opt) {
    var that = this;
    var layerIdMatch = false;
    if (typeof(that.activeLayer) === "undefined") {
      this.activeLayer = {};
    }
    if (opt) {
      // This is the non-csv layer case
      that.chart.options.axisX.valueFormatString = opt.dateFormat || "YYYY";
      that.activeLayer.title = opt.graphTitle;
      that.chart.options.axisY.title = opt.yAxisTitle;
      that.chart.options.graphGroupName = opt.graphGroupName;
      if (that.chart.options.axisX.valueFormatString == "YYYY") {
        that.chart.options.axisX.interval = 1;
        that.chart.options.axisX.intervalType = "year";
      }
      if (typeof(that.activeLayer.entries) === "undefined") {
        that.activeLayer.entries = {};
      }
      var entry = [];
      if (opt.hasTimelineChange) {
        var timelineUIChangeListener = function() {
          var dates = this.earthTime.timelapse.getCaptureTimes();
          for (var i = 0; i < dates.length; i++) {
            entry.push({
              x: new Date(dates[i], 0, 1),
              y: opt.data[i]
            });
          }
          that.chart.render();
          var deleteListener = true;
          for (var entryName in that.activeLayer.entries) {
            if (that.activeLayer.entries[entryName].length == 0) {
              deleteListener = false;
              break;
            }
          }
          if (deleteListener) {
            this.earthTime.timelapse.removeTimelineUIChangeListener(timelineUIChangeListener);
          }

        }
        this.earthTime.timelapse.addTimelineUIChangeListener(timelineUIChangeListener);
      }
      that.activeLayer.entries[layerId] = entry;
    } else {
      var layer = this.earthTime.layerDB.getLayer(layerId);
      if (layer) {
        if (!layer.showGraph) return;
        layerIdMatch = true;
        
        var tiles = layer._tileView._tiles;
        var key = Object.keys(tiles)[0];
        if (typeof key == "undefined") return;
        if (!tiles[key].jsondata) return;
        var data = tiles[key].jsondata.data;
        var layerProps = layer?.layer.layerDef;
        that.activeLayer.title = layerProps['Graph Title'] || layerProps['Name'];
        that.chart.options.graphGroupName = that.activeLayer.title;
        that.chart.options.axisY.title = layerProps['Graph Y-Axis Label'] || "Value";
        that.chart.options.axisX.title = layerProps['Graph X-Axis Label'] || "Time";
        
        if (layerProps['Graph Y-Axis Min']) {
          that.chart.options.axisY.minimum = layerProps['Graph Y-Axis Min'];
        } else {
          // Set to null to auto scale
          that.chart.options.axisY.minimum = null;
        }
        if (layerProps['Graph Y-Axis Max']) {
          that.chart.options.axisY.maximum = layerProps['Graph Y-Axis Max'];
        } else {
          // Set to null to auto scale
          that.chart.options.axisY.maximum = null;
        }
        that.chart.options.axisX.interval = undefined;
        that.getDataForLayer(data, layerProps);
        layerIdMatch = true;
      }
      
      if (!layerIdMatch) {
        console.log("Warning. Graphing unavailable for this layer: " + layerId + " Check layer name.");
        return;
      }
    }
    if (!opt || opt && !opt.graphGroupName) {
      this.chart.options.data = [];
      $("#csvChartLegendList").empty();
    }
    var idx = this.chart.options.data.length;
    var availableColors = layerProps['Graph Plot Colors'] ? JSON.parse(layerProps['Graph Plot Colors']).concat(that.colors) : that.colors;
    var plotsInitiallyActive = layerProps['Graph Plots First Visible'] ? JSON.parse(layerProps['Graph Plots First Visible']) : [];
    var visibleCount = 0;
    for (var entryName in that.activeLayer.entries) {
      var alreadyAdded = false;
      for (var i = 0; i < idx; i++) {
        if (that.chart.options.data[i].name == entryName) {
          alreadyAdded = true;
          break;
        }
      }
      if (!entryName || alreadyAdded) continue;
      var markerType = "circle";
      var initialVisibility = idx == 0 || opt && opt.startVisible ? true : false;
      visibleCount = $("#csvChartLegendList").find(".chartEntrySelected").length;
      var initialToolTipContent  = idx == 0 ? undefined : null;
      // Fallback to black if we run out of colors
      var markerColor = opt && opt.markerColor ? opt.markerColor : availableColors[idx] || "black";
      if (plotsInitiallyActive.indexOf(idx) >= 0) {
        initialVisibility = true;
        initialToolTipContent = undefined;
      }
      // TODO: Allow for different marker types in spreadsheet?
      // TODO: Remove legacy case for 'National'
      if (entryName == "National") {
        markerType = "square";
        markerColor = "black";
        initialVisibility = true;
        initialToolTipContent = undefined;
      }
      that.chart.options.data.push({
        type: "line",
        click: function(e) {
          this.earthTime.timelapse.seekToFrame(this.earthTime.timelapse.findExactOrClosestCaptureTime(String(e.dataPoint.x), "down"));
        },
        showInLegend: true,
        toolTipContent: initialToolTipContent,
        name: entryName,
        layerTitle: opt ? opt.layerTitle : that.activeLayer.title,
        markerType: markerType,
        color: markerColor,
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

    this.chart.options.title.text = visibleCount >= 1 ? that.chart.options.graphGroupName : this.activeLayer.title;
    this.chart.render();
  }

  removePlot(layerId) {
    if (this.activeLayer.entries) {
      delete this.activeLayer.entries[layerId];
    }
    for (var i = 0; i < this.chart.options.data.length; i++) {
      if (this.chart.options.data[i].name == layerId) {
        this.chart.options.data.splice(i, 1);
        $("#csvChartLegendList li").eq(i).remove();
        var $selectedPlots = $("#csvChartLegendList").find(".chartEntrySelected");
        var title;
        if ($selectedPlots.length == 1) {
          var idx = $($selectedPlots).first().closest("li").index();
          title = this.chart.options.data[idx].layerTitle;
        } else {
          title = this.chart.options.graphGroupName;
        }
        this.activeLayer.title = title;
        this.chart.options.title.text = title;
        this.chart.render();;
        break;
      }
    }
    var $legendEntries = $("#csvChartLegendList").find("li");

    $legendEntries.each(function(index, elem) {
      $(elem).attr("id", "csv-entry-" + index);
    });
    if ($legendEntries.length == 0) {
      this.chart.options.data = [];
      $("#csvChartLegendList").empty();
    }
  }

  removeAllPlots() {
    for (var key in this.activeLayer.entries) {
      this.removePlot(key);
    }
  }

  updateGraphData(layerId, data) {
    for (var entryName in this.activeLayer.entries) {
      if (entryName == layerId) {
        var plotData = this.activeLayer.entries[entryName];
        for (var i = 0; i < plotData.length; i++) {
          plotData[i].y = data[i];
        }
        for (var i = 0; i < this.chart.options.data.length; i++) {
          if (this.chart.options.data[i].name == layerId) {
            this.chart.options.data[i].dataPoints = plotData;
          }
        }
        this.chart.render();
        break;
      }
    }
  };

  getDataForLayer(layerData, layerProps) {
    var that = this;
    this.activeLayer.entries = {};

    var header = layerData[0];
    var has_lat_lon = (
      header[1].substr(0, 3).toLowerCase() == 'lat' &&
      header[2].substr(0, 3).toLowerCase() == 'lon');
    var first_data_col = has_lat_lon ? 3 : 1;

    // Times are contained in the first array
    for (var i = 1; i < layerData.length; i++) {
      var plotName = layerData[i][0].trim();
      if (!plotName) continue;
      that.activeLayer.entries[plotName] = [];
      var entry = that.activeLayer.entries[plotName];
      for (var j = first_data_col; j < layerData[i].length; j++) {
        var date = header[j];
        var yyyymm_re = /(\d{4})(\d{2})$/;
        var m = date.match(yyyymm_re);
        if (m) {
          that.chart.options.axisX.valueFormatString = "YYYY-MM";
          that.chart.options.axisX.intervalType = "month";
          that.chart.options.axisX.interval = layerProps['Graph X-Axis Label Interval'] || 4;
          date = new Date(m[1], m[2] - 1, 1);
        } else {
          that.chart.options.axisX.valueFormatString = "YYYY";
          that.chart.options.axisX.intervalType = "year";
          that.chart.options.axisX.interval = layerProps['Graph X-Axis Label Interval'] || 1;
          date = new Date(header[j], 0, 1);
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
  }
}

