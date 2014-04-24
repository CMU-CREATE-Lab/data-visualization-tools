define(["Class", "Data/Pack"], function (Class, Pack) {
  return Class({
    initialize: function (header, columns) {
      var self = this;
      self.header = header;
      self.columns = columns;
    },

    arrayBufferToString: function(buf) {
      return String.fromCharCode.apply(null, new Uint8Array(buf));
    },

    pack: function(method, size, value) {
      var d = new Uint8ClampedArray(size);


      return arrayBufferToString(d);
    },

    asBin: function () {
      var self = this;

      var header = $.extend({}, self.header);
      var datalen = Math.max.apply(Math, Object.values(self.columns).map(function (col) { return col.length; }));
      var cols = {};
      var coltypes = {};
      var nrseries = 0;
      var rowLen = 0;
      var series = function () {}; // Not equal to anything that you can find in a json

      Object.items(self.columns).map(function (item) {
        var key = item.key;
        var col = item.value;
        var t = col.constructor;

        cols[key] = {'name': key, 'type': Pack.typemap.byarray[t].name};
        coltypes[key] = t;
        rowLen += Pack.typemap.byarray[t].size;

        for (var i = 0; i < col.length; i++) {
          var value = col[i];

          if (key == "series" && value != series) {
            nrseries += 1;
            series = value;
          }

          if (value == undefined || isNaN(value)) continue;

          if (cols[key].min == undefined) cols[key].min = value;
          if (cols[key].max == undefined) cols[key].max = value;
          cols[key].max = Math.max(cols[key].max, value);
          cols[key].min = Math.min(cols[key].min, value);
        }
      });


      if (header.colsByName) {
        var colsByName = header.colsByName;
        delete header.colsByName;
        for (var key in cols) {
          if (colsByName.key != undefined) {
            $.extend(cols[key], colsByName[key]);
          }
        }
      }

      cols = Object.values(cols);
      cols.sort(function (a, b) {
        if (a.name < b.name) {
          return -1;
        } else if (a.name > b.name) {
          return 1;
        } else {
          return 0;
        }
      });
      $.extend(header, {'cols': cols, 'length': datalen, 'series': nrseries});

      var headerstr = JSON.stringify(header)

      var output = Pack.pack(Pack.typemap.byname.Int32, headerstr.length, true) + headerstr;

      for (var rowidx = 0; rowidx < datalen; rowidx++) {
        for (var colidx = 0; colidx < cols.length; colidx++) {
          var col = cols[colidx];
          var spec = Pack.typemap.byname[col.type];
          var value = self.columns[col.name][rowidx];
          output += Pack.pack(spec, value, true);
        }
      }

      return output;
    },

    asURI: function () {
      var self = this;
      return "data:application/binary;base64," + btoa(self.asBin());
    }
  });
});
