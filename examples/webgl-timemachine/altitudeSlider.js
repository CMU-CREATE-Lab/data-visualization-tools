"use strict";
var AltitudeSlider = function AltitudeSlider() {
	this.initialValue = 260;
	this.handle =  null;
	this.altitudeLayer = null;
	
	//on document load
	var that = this;
	$(function() {
		that.sliderObject = $( "#altitude-slider" );
		that.altitudeDisplay = $("#altitude-slider > div");
		
		var updateSliderValue = function (event, logVal) {
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
			slide: function( event, ui ) {
				var dataLayer = activeEarthTimeLayers[activeEarthTimeLayers.length-1]; //TODO: debug this line with use of this.altitudeLayer
				var logVal = Math.round(Math.pow(1.05,ui.value));
				csvFileLayers.updateLayerData(dataLayer, {options: {"maxElevation" : logVal}}, false, false)
				updateSliderValue(event,logVal);
			}
		});
	});
};

// Update altitude layer stored in AltitudeSlider object
AltitudeSlider.prototype.checkAltitudeLayer = function checkAltitudeLayer(layerList){
  layerList = layerList || activeEarthTimeLayers;
  this.altitudeLayer = null;
  for (var i=0; i< layerList.length; i++){
    var layer = getLayer(layerList[i]);
    if(layer && layer.setDataOptions && layer.setDataOptions.hasAltitude){
      this.altitudeLayer = layer;
	  break;
    }
  }
}

// Handle slider from page load or new layer added/removed (from data library)
AltitudeSlider.prototype.handleAltitudeLayers = function handleAltitudeLayers(fromShareLink,layers){
  this.checkAltitudeLayer(); //uses activeEarthTimeLayers if layers undefined
  updateAltitudeSlider(this); // hide/show calendar


  function updateAltitudeSlider(that){
    if (that.altitudeLayer == null){ //hide button if no altitude layers
      $("#altitude-slider").hide();
    }
    else{ 
      $("#altitude-slider").show();
    }
  }
}