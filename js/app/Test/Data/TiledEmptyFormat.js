define(["app/Class", "QUnit", "app/Test/BaseTest", "app/Bounds", "app/Data/TiledEmptyFormat"], function(Class, QUnit, BaseTest, Bounds, TiledEmptyFormat) {
  return Class(BaseTest, {
    name: "TiledEmptyFormat",

    "Loading tiles": function (cb) {
      QUnit.expect(2);

      var p = new TiledEmptyFormat({url:"http://example.com/TiledEmptyFormat"});
      p.events.on({
        all: function () {
          var expectedWantedTiles = [
            "0,0,2.8125,1.40625",
            "0,1.40625,2.8125,2.8125",
            "0,2.8125,2.8125,4.21875",
            "0,4.21875,2.8125,5.625",
            "0,5.625,2.8125,7.03125",
            "0,7.03125,2.8125,8.4375",
            "0,8.4375,2.8125,9.84375",
            "0,9.84375,2.8125,11.25",
            "2.8125,0,5.625,1.40625",
            "2.8125,1.40625,5.625,2.8125",
            "2.8125,2.8125,5.625,4.21875",
            "2.8125,4.21875,5.625,5.625",
            "2.8125,5.625,5.625,7.03125",
            "2.8125,7.03125,5.625,8.4375",
            "2.8125,8.4375,5.625,9.84375",
            "2.8125,9.84375,5.625,11.25",
            "5.625,0,8.4375,1.40625",
            "5.625,1.40625,8.4375,2.8125",
            "5.625,2.8125,8.4375,4.21875",
            "5.625,4.21875,8.4375,5.625",
            "5.625,5.625,8.4375,7.03125",
            "5.625,7.03125,8.4375,8.4375",
            "5.625,8.4375,8.4375,9.84375",
            "5.625,9.84375,8.4375,11.25",
            "8.4375,0,11.25,1.40625",
            "8.4375,1.40625,11.25,2.8125",
            "8.4375,2.8125,11.25,4.21875",
            "8.4375,4.21875,11.25,5.625",
            "8.4375,5.625,11.25,7.03125",
            "8.4375,7.03125,11.25,8.4375",
            "8.4375,8.4375,11.25,9.84375",
            "8.4375,9.84375,11.25,11.25"
          ];
          var expectedTileCache = expectedWantedTiles;

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
      p.zoomTo(new Bounds(0, 0, 10, 10));
    },

    "Keeping loaded tiles until new ones are loaded": function (cb) {
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
      p.zoomTo(new Bounds(0, 0, 10, 10));
    },



  });
});
