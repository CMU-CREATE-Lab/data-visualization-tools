import { EarthTime } from './EarthTime'
import { LayerProxy } from './LayerProxy';

export class AltitudeSlider {
  initialValue: number;
  handle: any;
  altitudeLayer: LayerProxy;
  sliderObject: JQuery<HTMLElement>;
  altitudeDisplay: JQuery<HTMLElement>;
  earthTime: EarthTime;
  constructor(earthTime: EarthTime) {
    this.earthTime = earthTime;
    this.initialValue = 260;
    this.handle = null;
    this.altitudeLayer = null;

    //on document load
    var that = this;
    $(function() {
      that.sliderObject = $("#altitude-slider");
      that.altitudeDisplay = $("#altitude-slider > div");

      var updateSliderValue = function(event, logVal) {
        that.handle = that.handle || $(".ui-slider-handle", that.sliderObject);
        that.altitudeDisplay.text((parseInt(logVal) || that.initialValue) + "m")
          .css(that.handle.position());
      };

      that.sliderObject.slider({
        orientation: "vertical",
        value: that.initialValue,
        min: 33,
        max: 114,
        step: 1,
        animate: "fast",
        create: updateSliderValue,
        slide: function(event, ui) {
          var dataLayer = this.earthTime.layerDB.shownLayers[this.earthTime.layerDB.shownLayers.length - 1]; //TODO: debug this line with use of this.altitudeLayer
          var logVal = Math.round(Math.pow(1.05, ui.value));
          dataLayer.updateData({
            options: {
              "maxElevation": logVal
            }
          }, false, false);
          updateSliderValue(event, logVal);
        }
      }).attr("title", "Drag to change the max elevation being drawn");
    });
  }
  // Update altitude layer stored in AltitudeSlider object
  checkAltitudeLayer(layerList = null) {
    layerList = layerList || this.earthTime.layerDB.shownLayers;
    this.altitudeLayer = null;
    for (let layer of layerList) {
      if (layer.setDataOptions && layer.setDataOptions.hasAltitude) {
        this.altitudeLayer = layer;
        break;
      }
    }
  }
  // Handle slider from page load or new layer added/removed (from data library)
  handleAltitudeLayers() {
    this.checkAltitudeLayer(); //uses activeEarthTimeLayers if layers undefined
    updateAltitudeSlider(this); // hide/show calendar


    function updateAltitudeSlider(that) {
      if (that.altitudeLayer == null) { //hide button if no altitude layers
        $("#altitude-slider").hide();
      }
      else {
        $("#altitude-slider").show();
      }
    }
  }
}
