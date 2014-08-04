define(["app/Class", "app/Data/Format", "app/Data/Selection", "app/Data/Pack", "app/Data/GeoProjection", "lodash"], function(Class, Format, Selection, Pack, GeoProjection, _) {
  return Class(Format, {
    name: "DataView",

    /* This specification can be overridden by a parameter to the
     * constructor.
     *
     * After initialization, self.header.colsByName will contain this
     * information, plus:
     *
     * For each column = self.header.colsByNam.COLUMNNAME:
     *   column.typespec = Pack.typemap.byname[column.type]
     *   For each item index i:
     *     column.items[i].index = i
     *     column.itemsByName[column.items[i].name] = column.items[i]
     */

    columns: {
      points: {type: "Int32", items: [
        {name: "latitude", source: {latitude: 1.0}},
        {name: "longitude", source: {longitude: 1.0}}]},
      color: {type: "Int32", items: [
        {name: "red", source: {_: 1.0}},
        {name: "green", source: {_: 1.0}},
        {name: "blue", source: {_: 0.0}}]},
      magnitude: {type: "Int32", items: [
        {name: "magnitude", source: {_: 1.0}}]}
    },

    transforms: {
      coordinate: function (col, offset) {
        var spec = this;
        var longitude = col[offset + spec.itemsByName.longitude.index];
        var latitude = col[offset + spec.itemsByName.latitude.index];

        var pixel = GeoProjection.LatLongToPixelXY(latitude, longitude);

        col[offset + spec.itemsByName.latitude.index] = pixel.y;
        col[offset + spec.itemsByName.longitude.index] = pixel.x;
      },
      rowidx: function (col, offset) {
        var spec = this;
        var rowidx = (offset / spec.items.length) + 1;

        col[offset + spec.itemsByName.r.index] = ((rowidx >> 16) & 0xff) / 255;
        col[offset + spec.itemsByName.g.index] = ((rowidx >> 8) & 0xff) / 255;
        col[offset + spec.itemsByName.b.index] = (rowidx & 0xff) / 255;
        col[offset + spec.itemsByName.a.index] = 1.0;
      },

      coordinate2: function (col, offset) {
        var spec = this;
        var longitude_start = col[offset + spec.itemsByName.longitude_start.index];
        var latitude_start = col[offset + spec.itemsByName.latitude_start.index];
        var longitude_end = col[offset + spec.itemsByName.longitude_end.index];
        var latitude_end = col[offset + spec.itemsByName.latitude_end.index];

        var pixel_start = GeoProjection.LatLongToPixelXY(latitude_start, longitude_start);
        var pixel_end = GeoProjection.LatLongToPixelXY(latitude_end, longitude_end);

        col[offset + spec.itemsByName.latitude_start.index] = pixel_start.y;
        col[offset + spec.itemsByName.longitude_start.index] = pixel_start.x;
        col[offset + spec.itemsByName.latitude_end.index] = pixel_end.y;
        col[offset + spec.itemsByName.longitude_end.index] = pixel_end.x;
      },
      rowidx2: function (col, offset) {
        var spec = this;
        var rowidx = (offset / spec.items.length) + 1;

        col[offset + spec.itemsByName.sr.index] = ((rowidx >> 16) & 0xff) / 255;
        col[offset + spec.itemsByName.sg.index] = ((rowidx >> 8) & 0xff) / 255;
        col[offset + spec.itemsByName.sb.index] = (rowidx & 0xff) / 255;
        col[offset + spec.itemsByName.sa.index] = 1.0;
        col[offset + spec.itemsByName.er.index] = ((rowidx >> 16) & 0xff) / 255;
        col[offset + spec.itemsByName.eg.index] = ((rowidx >> 8) & 0xff) / 255;
        col[offset + spec.itemsByName.eb.index] = (rowidx & 0xff) / 255;
        col[offset + spec.itemsByName.ea.index] = 1.0;
      }

    },

    initialize: function (source, args) {
      var self = this;

      if (app.worker) {
        app.worker.addDataset('data');
        app.worker.addDataset('series');
      }

      Format.prototype.initialize.call(self)
      self.source = source;

      if (args) _.extend(self, args);

      self.selections = {};

      self.source.events.on({
        update: self.handleUpdate,
        error: self.handleError,
        scope: self
      });

      Object.items(self.columns).map(function (item) {
        var value = _.cloneDeep(item.value);
        value.name = item.key;
        self.addCol(value);
      });

      if (args.selections) {
        Object.items(args.selections).map(function (item) {
          self.addSelectionCategory(item.key, item.value);
        });
      } else {
        self.addSelectionCategory("selected");
        self.addSelectionCategory("info");
        self.addSelectionCategory("hover");
      }

      self.lastUpdate = undefined;
      self.updateInterval = setInterval(self.performUpdate.bind(self), 500);
    },

    addSelectionCategory: function (name, args) {
      var self = this;
      args = _.clone(args || {});
      if (!args.sortcols) args.sortcols = self.source.sortcols.slice(0, 1);
      self.selections[name] = new Selection(args);
      self.selections[name].events.on({
        update: function (e) {
          e = _.clone(e);
          e.category = name;
          e.update = "selection-" + e.update;
          self.handleUpdate(e);
        }
      });
    },

    addSelectionRange: function (type, startidx, endidx, replace) {
      var self = this;
      if (!self.selections[type]) return;
      self.selections[type].addRange(self.source, startidx, endidx, replace);
      self.events.triggerEvent('spec-update', {json: self.toJSON(), string: self.toString()});
    },

    getSelectionInfo: function (name, cb) {
      var self = this;
      self.source.getSelectionInfo(self.selections[name], cb);
    },

    handleUpdate: function (update) {
      var self = this;

      self.lastUpdate = update;
    },

    updateSeries: function() {
      var self = this;
      var header = self.source.header;
      var data = self.source.data;

      // For convenience we store POINT_COUNT in an element at the end
      // of the array, so that the length of each series is
      // series[i+1]-series[i].
      self.series = new Int32Array(Math.max(2, self.source.seriescount + 1));
      self.series[0] = 0;
      self.series[self.series.length - 1] = header.length;

      self.lastSeries = function () {}; // Value we will never find in the data
      self.seriescount = 0;
      if (data.series) {
        for (var rowidx = 0; rowidx < header.length; rowidx++) {
          var series = data.series[rowidx];
          if (self.lastSeries != series) {
            self.seriescount++;
            self.lastSeries = series;
          }
          self.series[self.seriescount] = rowidx + 1;
        }
      }
      self.seriescount = Math.max(self.seriescount, 1);
    },

    performUpdate: function (update) {
      var self = this;

      if (!self.lastUpdate) return;
      var lastUpdate = self.lastUpdate;
      self.lastUpdate = undefined;

      self.header.length = self.source.header.length;
      self.seriescount = self.source.seriescount;

      Object.keys(self.header.colsByName).map(self.updateCol.bind(self));
      self.updateSeries();

      lastUpdate.json = self.toJSON();
      lastUpdate.string = self.toString();
      lastUpdate.header = self.header;

      self.events.triggerEvent(lastUpdate.update, lastUpdate);
      self.events.triggerEvent("update", lastUpdate);
    },

    handleError: function (error) {
      var self = this;
      self.events.triggerEvent("error", error);
    },

    updateCol: function (colname) {
      var self = this;
      self.useData(function (data, cb) {
        var spec = self.header.colsByName[colname];
        if (   !data[colname]
            || data[colname].length != self.source.header.length * spec.items.length) {
          data[colname] = new (eval(spec.typespec.array))(self.source.header.length * spec.items.length);
        }

        for (var rowidx = 0; rowidx < self.source.header.length; rowidx++) {
          for (var item = 0; item < spec.items.length; item++) {
            var source = spec.items[item].source;
            var res = source._ || 0; 
            for (var key in source) {
              if (key != '_') {
                if (self.selections[key]) {
                  res += source[key] * (self.selections[key].checkRow(self.source, rowidx) ? 1.0 : 0.0);
                } else {
                  if (self.source.data[key]) {
                    res += source[key] * self.source.data[key][rowidx];
                  }
                }
              }
            }
            data[colname][rowidx * spec.items.length + item] = res;
          }
          if (spec.transform) {
            self.transforms[spec.transform].call(spec, data[colname], rowidx * spec.items.length);
          }
        }
        cb();
      });
    },

    _changeCol: function(update, spec) {
      var self = this;
      spec = _.clone(spec);
      spec.itemsByName = {};
      for (var i = 0; i < spec.items.length; i++) {
        spec.items[i].index = i;
        spec.itemsByName[spec.items[i].name] = spec.items[i];
      }
      spec.typespec = Pack.typemap.byname[spec.type];

      self.header.colsByName[spec.name] = spec;

      self.updateCol(spec.name);

      var e = {
        update: update,
        name: spec.name,
        json: self.toJSON(),
        header: self.header,
        string: self.toString()
      };
      self.events.triggerEvent(e.update, e);
      self.events.triggerEvent('update', e);
    },

    addCol: function(spec) {
      var self = this;
      self._changeCol("add-col", spec);
    },

    changeCol: function(spec) {
      var self = this;
      self._changeCol("change-col", spec);
    },

    removeCol: function(name) {
      var self = this;

      self.useData(function (data, cb) {
        delete self.header.colsByName[name];
        delete data[name];

        var e = {
          update: 'remove-col',
          name: spec.name,
          json: self.toJSON,
          header: self.header,
          string: self.toString()
        };
        self.events.triggerEvent(e.update, e);
        self.events.triggerEvent('update', e);
        cb();
      });
    },

    useData: function (fn) {
      var self = this;
      if (app.worker) {
        app.worker.withDataset('data', fn);
      } else {
        fn(self.data, function () {});
      }
    },

    useSeries: function (fn) {
      var self = this;
      if (app.worker) {
        app.worker.withDataset('series', fn);
      } else {
        fn(self.series || [], function () {});
      }
    },

    useHeader: function (fn) {
      var self = this;
      fn(self.header, function () {});
    },

    getAvailableColumns: function (cb) {
      var self = this;

      cb(
        null,
        Object.keys(self.source.header.colsByName).concat(
          Object.keys(self.selections)));
    },

    load: function () {
      var self = this;
      self.source.load();
    },

    toJSON: function () {
      var self = this;
      var cols = _.cloneDeep(self.header.colsByName);
      for (var name in cols) {
        delete cols[name].itemsByName;
        delete cols[name].typespec;
        cols[name].items.map(function (item) {
          delete item.index;
        });
      }
      return {
        columns: cols,
        selections: self.selections
      };
    },

    toString: function () {
      var self = this;

      return self.source.toString();
    }
  });
});