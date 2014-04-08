Tile = Class({
  initialize: function(manager, bounds) {
    var tile = this;
    tile.manager = manager;
    tile.bounds = bounds;
    tile.data = {};
    tile.rowcount = 0;
    tile.loaded = {};
    tile.loading_started = false;
    tile.events = new Events();
  },

  load: function() {
    var tile = this;

    if (tile.loading_started) return;
    tile.loading_started = true;

    loadTypedMatrix({
      url: tile.manager.source + "/" + tile.bounds.toBBOX(),
      header: function (data) { tile.headerLoaded(data); },
      row: function (data) { tile.rowLoaded(data); },
      batch: function () { tile.batchLoaded(); },
      done: function () { tile.allLoaded(); },
      error: function (exception) { tile.errorLoading(exception); }
    });
  },

  headerLoaded: function (data) {
    var tile = this;

    tile.header = data;
    for (var name in tile.header.colsByName) {
      var col = tile.header.colsByName[name];
      tile.data[name] = new col.typespec.array(tile.header.length);
      tile.loaded[name] = {min: undefined, max: undefined};
    }

    tile.events.triggerEvent("header", data);
  },

  rowLoaded: function(data) {
    var tile = this;

    for (var name in tile.header.colsByName) {
      tile.data[name][tile.rowcount] = data[name];
      tile.loaded[name].min = tile.loaded[name].min == undefined ? data[name] : Math.min(tile.loaded[name].min, data[name]);
      tile.loaded[name].max = tile.loaded[name].max == undefined ? data[name] : Math.max(tile.loaded[name].max, data[name]);
    }

    tile.rowcount++;
    tile.events.triggerEvent("row", data);
  },

  batchLoaded: function () {
    var tile = this;

    tile.events.triggerEvent("batch");
  },

  allLoaded: function () {
    var tile = this;

    // We aren't getting any more, so if anyone's waiting they'd be
    // waiting forever if we didn't tell them...
    tile.header.length = tile.rowcount;
    tile.events.triggerEvent("all");
  },

  errorLoading: function (exception) {
    var tile = this;

    tile.error = exception;
    tile.events.triggerEvent("error", {"exception": exception});
  }
});
