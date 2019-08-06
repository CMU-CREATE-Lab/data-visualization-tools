var ET = {}

ET.waitForLayers = function(callback) {
  if ($('#category-base-layers.ui-accordion-content').length > 0) {
    callback();
  } else {
    window.setTimeout(function () {ET.waitForLayers(callback);}, 100);
  }
}

ET.getCurrentViewBounds = function() {
  var pixelBounds = timelapse.getBoundingBoxForCurrentView();
  var nw = timelapse.getProjection().pointToLatlng({x:pixelBounds.xmin, y:pixelBounds.ymin});
  var se = timelapse.getProjection().pointToLatlng({x:pixelBounds.xmax, y:pixelBounds.ymax});
  var ret = [nw.lat, nw.lng, se.lat, se.lng];
  return ret;
}
