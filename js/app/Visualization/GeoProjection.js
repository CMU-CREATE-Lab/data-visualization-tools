/*
  Use google maps Mercator projection to convert from lat, lng to
  x, y coords in the range x:0-256, y:0-256
*/
define(["app/Class"], function (Class) {
  var GeoProjection = Class({name: "GeoProjection"});

  GeoProjection.LatLongToPixelXY = function(latitude, longitude) {
    var x = (longitude + 180) * 256 / 360;
    var y = 128 - Math.log(Math.tan((latitude + 90) * Math.PI / 360)) * 128 / Math.PI;
    return {x: x, y: y};
  };

  GeoProjection.PixelXYToLatLong = function(xy) {
    var lat = Math.atan(Math.exp((128 - xy.y) * Math.PI / 128)) * 360 / Math.PI - 90;
    var lng = xy.x * 360 / 256 - 180;
    return {lat: lat, lng: lng};
  };

  GeoProjection.circumferenceOfEarthAtLatitude = function(latitude) {
    return Math.cos(latitude * Math.PI/180).toFixed(8) * 40075017;
  };
      
  GeoProjection.getMetersPerPixelAtLatitude = function(latitude, zoom) {
    return GeoProjection.circumferenceOfEarthAtLatitude(latitude) / (256 * Math.pow(2,zoom)) ;
  };
      
  GeoProjection.getPixelDiameterAtLatitude = function(diameterInMeters, latitude, zoom) {
    return diameterInMeters / GeoProjection.getMetersPerPixelAtLatitude(latitude, zoom);
  };

  return GeoProjection;
});
