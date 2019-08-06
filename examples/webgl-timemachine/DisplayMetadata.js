var zzdm, zzlayer, zztile;

function DisplayMetadata(timelapse) {
  zzdm = this;
  this.timelapse = timelapse;
  $('#'+timelapse.getDataPanesContainerId()).click(this.handleClick.bind(this));
  this.mercatorProj = new org.gigapan.timelapse.MercatorProjection(
      -180, 85.05112877980659, 180, -85.05112877980659,
    256, 256);
};

// TODO: move this to layer

DisplayMetadata.prototype.latLngToLayerCoords = function(layer, latLng) {
  // New Landsat basemap no longer starts at standard Web Mercator north of 85.xxx
  // Compute offset in units of timelapse.getView() pixels
  var yOffset = timelapse.getProjection().latlngToPoint({
    lat: NORTH,
    lng: 0
  }).y;

  var timelapseCoords = this.timelapse.getProjection().latlngToPoint(latLng);
  
  var timelapse2layer = layer.getWidth() / this.timelapse.getPanoWidth();
  
  timelapseCoords.y -= yOffset;

  timelapseCoords.x *= timelapse2layer;
  timelapseCoords.y *= timelapse2layer;
  return timelapseCoords;
};

DisplayMetadata.prototype.handleClick = function(e) {
  return;
  console.log('ZZZ handleClick', e);
  var yOffsetToAskPaulAbout = -24;
  var timeMachineCoord = this.timelapse.convertViewportToTimeMachine({x:e.offsetX, y:e.offsetY + yOffsetToAskPaulAbout});
  var latLng = this.timelapse.getProjection().pointToLatlng(timeMachineCoord);
  console.log('ZZZ latLng', latLng);

  for (var i = 0; i < csvFileLayers.layers.length; i++) {
    var layer = csvFileLayers.layers[i];
    if (layer.visible && layer.mapType == 'choropleth') {
      console.log('ZZZ visible choropleth', layer);
      this.findMetadataInChoropleth(layer, latLng);
      zzlayer = layer;
    }
  }
};

DisplayMetadata.prototype.findMetadataInChoropleth = function(layer, latLng) {
  var layerCoords = this.latLngToLayerCoords(layer, latLng);
  console.log('ZZZ layerCoords', layerCoords);
  var tile = layer.getTileView().highestResolutionTileAt(layerCoords);
  console.log('ZZZ found tile', tile);
  if (!tile) return;
  zztile = tile;
};

