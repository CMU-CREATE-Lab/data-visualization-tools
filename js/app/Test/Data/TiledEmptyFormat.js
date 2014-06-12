define(["app/Class", "QUnit", "app/Test/BaseTest", "app/Bounds", "app/Data/TiledEmptyFormat"], function(Class, QUnit, BaseTest, Bounds, TiledEmptyFormat) {
  var expectedWantedTiles = [
    "0,0,2.8125,1.40625",
    "0,1.40625,2.8125,2.8125",
    "0,2.8125,2.8125,4.21875",
    "0,4.21875,2.8125,5.625",
    "2.8125,0,5.625,1.40625",
    "2.8125,1.40625,5.625,2.8125",
    "2.8125,2.8125,5.625,4.21875",
    "2.8125,4.21875,5.625,5.625",
    "5.625,0,8.4375,1.40625",
    "5.625,1.40625,8.4375,2.8125",
    "5.625,2.8125,8.4375,4.21875",
    "5.625,4.21875,8.4375,5.625",
    "8.4375,0,11.25,1.40625",
    "8.4375,1.40625,11.25,2.8125",
    "8.4375,2.8125,11.25,4.21875",
    "8.4375,4.21875,11.25,5.625"
  ];
  var expectedTileCache = expectedWantedTiles;

  var expectedWantedTilesAfterZoom = [
    "0,0,1.40625,0.703125",
    "0,0.703125,1.40625,1.40625",
    "0,1.40625,1.40625,2.109375",
    "0,2.109375,1.40625,2.8125",
    "1.40625,0,2.8125,0.703125",
    "1.40625,0.703125,2.8125,1.40625",
    "1.40625,1.40625,2.8125,2.109375",
    "1.40625,2.109375,2.8125,2.8125",
    "2.8125,0,4.21875,0.703125",
    "2.8125,0.703125,4.21875,1.40625",
    "2.8125,1.40625,4.21875,2.109375",
    "2.8125,2.109375,4.21875,2.8125",
    "4.21875,0,5.625,0.703125",
    "4.21875,0.703125,5.625,1.40625",
    "4.21875,1.40625,5.625,2.109375",
    "4.21875,2.109375,5.625,2.8125"
  ];
  var expectedTileCacheAfterZoom = [
    "0,0,1.40625,0.703125",
    "0,0,2.8125,1.40625",
    "0,0.703125,1.40625,1.40625",
    "0,1.40625,1.40625,2.109375",
    "0,1.40625,2.8125,2.8125",
    "0,2.109375,1.40625,2.8125",
    "0,2.8125,2.8125,4.21875",
    "1.40625,0,2.8125,0.703125",
    "1.40625,0.703125,2.8125,1.40625",
    "1.40625,1.40625,2.8125,2.109375",
    "1.40625,2.109375,2.8125,2.8125",
    "2.8125,0,4.21875,0.703125",
    "2.8125,0,5.625,1.40625",
    "2.8125,0.703125,4.21875,1.40625",
    "2.8125,1.40625,4.21875,2.109375",
    "2.8125,1.40625,5.625,2.8125",
    "2.8125,2.109375,4.21875,2.8125",
    "2.8125,2.8125,5.625,4.21875",
    "4.21875,0,5.625,0.703125",
    "4.21875,0.703125,5.625,1.40625",
    "4.21875,1.40625,5.625,2.109375",
    "4.21875,2.109375,5.625,2.8125",
    "5.625,0,8.4375,1.40625",
    "5.625,1.40625,8.4375,2.8125",
    "5.625,2.8125,8.4375,4.21875"
  ];
  var expectedTileCacheAfterZoomAndLoad = expectedWantedTilesAfterZoom;

  return Class(BaseTest, {

    name: "TiledEmptyFormat",
    "Loading tiles": function (cb) {
      QUnit.expect(2);

      var p = new TiledEmptyFormat({url:"http://example.com/TiledEmptyFormat"});
      p.events.on({
        all: function () {
          var wantedTiles = Object.keys(p.wantedTiles);
          wantedTiles.sort();

          var tileCache = Object.keys(p.tileCache);
          tileCache.sort();

          QUnit.deepEqual(wantedTiles, expectedWantedTiles, "Wrong tiles requested");
          QUnit.deepEqual(tileCache, expectedTileCache, "Wrong tiles loaded");

          cb();
        }
      });

      p.load();
      p.zoomTo(new Bounds(0, 0, 10, 5));
    },

    "Keeping loaded tiles until new ones are loaded": function (cb) {
      QUnit.expect(5);

      var p = new TiledEmptyFormat({url:"http://example.com/TiledEmptyFormat"});

      loadStage = 0;

      p.events.on({
        all: function () {
          loadStage++;

          if (loadStage == 1) {
            var wantedTiles = Object.keys(p.wantedTiles);
            wantedTiles.sort();

            var tileCache = Object.keys(p.tileCache);
            tileCache.sort();

            QUnit.deepEqual(wantedTiles, expectedWantedTiles, "Request the right tiles for bounds");
            QUnit.deepEqual(tileCache, expectedTileCache, "Loaded the right tiles for bounds");

            p.headerTime = false;
            p.zoomTo(new Bounds(0, 0, 5, 2.5));

            setTimeout(function () {
              var wantedTiles = Object.keys(p.wantedTiles);
              wantedTiles.sort();

              var tileCache = Object.keys(p.tileCache);
              tileCache.sort();

              QUnit.deepEqual(wantedTiles, expectedWantedTilesAfterZoom, "Right tiles requested after second zoom");
              QUnit.deepEqual(tileCache, expectedTileCacheAfterZoom, "Right tiles loaded after second zoom");

              p.getLoadingTiles().map(function (tile) {
                tile.content.headerLoaded();
              });
            }, 2000);
          } else if (loadStage == 2) {
            var tileCache = Object.keys(p.tileCache);
            tileCache.sort();

            QUnit.deepEqual(tileCache, expectedTileCacheAfterZoomAndLoad, "Old tiles expunged after all new tiles are loaded");

            cb();
          }
        }
      });

      p.load();
      p.zoomTo(new Bounds(0, 0, 10, 5));
    },



  });
});
