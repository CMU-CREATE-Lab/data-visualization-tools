/* Loads a matrix of rows/cols of typed data from a binary file.


   Data format:

   All values in the data format are in little endian. The following
   describes the main data layout:

   [4 byte header length in bytes]
   [header data]
   [row]
   [row]
   ...

   The header is json encoded and should contain at the very least

   {length: NUMBER_OF_ROWS, cols: [COL,...]}

   COL should contain {name: NAME, type: TYPE}

   where NAME is any string and TYPE is one of the type names found
   in Pack.typemap.

   COL can optionally contain 'multiplier' and/or 'offset'. If defined
   for a column, the values in that column will be scaled and offset
   by those values:

   value = offset + (multiplier * value)

   Each row consists of data encoded as per the column
   specifications (in that same order). The byte length of each
   column is defined by its type.


   API:

   f = new TypedMatrixFormat(source_url);
   f.events.on({
     load: function () {}, // Called before loading begins
     header: function (headerData) {},
     row: function (rowData) {},
     batch: function () {},
     all: function () {},
     update: function () {}, // Called after both batch and all
     error: function (error) { console.log(error.exception); },
   });
   f.load();

   f.cancel(); // To cancel the loading at any time.

   The header data is available in f.header during and after the
   header event fires, in addition to being sent as a parameter to
   that event. The header data is the same as the header data found in
   the binary, with one extra member added, colsByName, which contains
   a json object with column names as keys and the column specs from
   cols as values.

   In addition, the COL column specifications are updated as
   following:

   Any min and max entries are updated using offset and
   multiplier, if they exist.

   A typespec member is added, which contains the type from TypMap
   corresponding to the type specified for the column.

   Type specifications in Pack.typemap have the following format:

   {
     size: BYTES_PER_ELEMENT,
     array: ArrayClass,
     method: 'dataViewAccessorMethodName'
   }


   Implementation details/explanation for this ugly code:

   moz-chunked-arraybuffer is only supported in firefox... So I
   reverted to the old-school overrideMimeType and loading the file
   is binary "text", and converting it to ArrayBuffer by hand for
   decoding.
*/

define(["app/Class", "app/Events", "app/Data/Pack"], function (Class, Events, Pack) {
  return Class({
    name: "TypedMatrixParser",
    initialize: function(url) {
      var self = this;

      self.header = {length: 0, colsByName: {}};
      self._headerLoaded = false;
      self.headerLen = null;
      self.offset = 0;
      self.rowidx = 0;
      self.rowLen = null;
      self.request = null;
      self.responseData = null;

      self.url = url;
      self.events = new Events("Data.TypedMatrixParser");
    },

    load: function () {
      var self = this;

      self.events.triggerEvent("load");

      if (window.XMLHttpRequest) {
        self.request = new XMLHttpRequest();
      } else {
        throw 'XMLHttpRequest is disabled';
      }
      /*
        if (request.responseType === undefined) {
          throw 'no support for binary files';
        }
      */

      self.request.open('GET', self.url, true);
      self.request.overrideMimeType('text\/plain; charset=x-user-defined');
      self.request.send(null);
      var handleDataCallback = function () {
        if (!self.handleData()) {
          setTimeout(handleDataCallback, 500);
        }
      }
      setTimeout(handleDataCallback, 500);

    },

    cancel: function () {
      var self = this;

      self.request.abort();
    },

    headerLoaded: function (data) {
      var self = this;
      self.events.triggerEvent("header", data);
    },

    rowLoaded: function(data) {
      var self = this;
      self.events.triggerEvent("row", data);
    },

    batchLoaded: function () {
      var self = this;
      var e = {update: "batch"};
      self.events.triggerEvent("batch", e);
      self.events.triggerEvent("update", e);
    },

    allLoaded: function () {
      var self = this;
      var e = {update: "all"};
      self.events.triggerEvent("all", e);
      self.events.triggerEvent("update", e);
    },

    errorLoading: function (exception) {
      var self = this;

      self.error = exception;
      self.events.triggerEvent("error", {"exception": exception});
    },

    handleData: function() {
      var self = this;

      if (!self.request) return;

      if (self.request.readyState == 4) {
        /* HTTP reports success with a 200 status. The file protocol
           reports success with zero. HTTP does not use zero as a status
           code (they start at 100).
           https://developer.mozilla.org/En/Using_XMLHttpRequest */
        if (self.request.status != 200 && self.request.status != 0) {
          self.errorLoading({msg: 'could not load: ' + self.url, status: self.request.status});
          return true;
        }
      }

      if (!self.request.responseText) return;

      var length = self.request.responseText.length;
      var text = self.request.responseText;

      if (length < 4) return;
      if (self.headerLen == null) {
        self.headerLen = new DataView(Pack.stringToArrayBuffer(text, 0, 4)).getInt32(0, true);
        self.offset = 4;
      }
      if (length < self.offset + self.headerLen) return;
      if (!self._headerLoaded) {
        self.header = JSON.parse(text.substr(self.offset, self.headerLen));
        self.rowLen = 0;
        self.header.colsByName = {};
        for (var colidx = 0; colidx < self.header.cols.length; colidx++) {
          var col = self.header.cols[colidx];
          col.idx = colidx;
          self.header.colsByName[col.name] = col;
          col.typespec = Pack.typemap.byname[col.type];

          if (col.multiplier != undefined && col.min != undefined) col.min = col.min * col.multiplier;
          if (col.offset != undefined && col.min != undefined) col.min = col.min + col.offset;
          if (col.multiplier != undefined && col.max != undefined) col.max = col.max * col.multiplier;
          if (col.offset != undefined && col.max != undefined) col.max = col.max + col.offset;

          self.rowLen += col.typespec.size;
        };

        self.offset = 4 + self.headerLen;
        self._headerLoaded = true;
        self.headerLoaded(self.header);
      }
      if (self.responseData == null) {
        // Yes, I'm lazy and allocate space for the header to, but we
        // never write it, just to not have to bother about two self.offsets
        self.responseData = new Uint8ClampedArray(self.offset + (self.rowLen * self.header.length));
      }
      Pack.writeStringToArrayBuffer(text, self.offset, undefined, self.responseData);

      var dataView = new DataView(self.responseData.buffer);

      if (self.rowLen) {
        for (; self.offset + self.rowLen <= length; self.rowidx++) {
          var row = {};
          for (var colidx = 0; colidx < self.header.cols.length; colidx++) {
            var col = self.header.cols[colidx];
            var val = dataView[col.typespec.getter](self.offset, true);
            if (col.multiplier != undefined) val = val * col.multiplier;
            if (col.offset != undefined) val = val + col.offset;
            row[col.name] = val;
            self.offset += col.typespec.size;
          }
          self.rowLoaded(row);
        }
      }
      if (self.rowidx == self.header.length) {
        self.allLoaded();
        return true;
      } else {
        self.batchLoaded();
      }
    }
  });
});
