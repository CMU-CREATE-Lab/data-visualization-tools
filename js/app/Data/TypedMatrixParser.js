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
   in TypedMatrixFormat.typemap.

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
     header: function (headerData) {}, // headerData is also available in f.header during and after this event fires.
     row: function (rowData) {},
     batch: function () {},
     all: function () {},
     error: function (error) { console.log(error.exception); },
   });
   f.load();


   Implementation details/explanation for this ugly code:

   moz-chunked-arraybuffer is only supported in firefox... So I
   reverted to the old-school overrideMimeType and loading the file
   is binary "text", and converting it to ArrayBuffer by hand for
   decoding.
*/

define(["Class", "Events"], function (Class, Events) {
  TypedMatrixFormat = Class({
    initialize: function(url) {
      var self = this;
      self.url = url;
      self.events = new Events();
    },

    load: function () {
      var self = this;

      self.header = {length: 0, colsByName: {}};
      self._headerLoaded = false;
      self.headerLen = null;
      self.offset = 0;
      self.rowidx = 0;
      self.rowLen = null;
      self.request = null;
      self.responseData = null;

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

    writeStringToArrayBuffer: function(str, start, end, buf, bufstart) {
      if (end == undefined) end = str.length;
      if (start == undefined) start = 0;
      if (bufstart == undefined) bufstart = start;
      for (var i = start; i < end; i++) buf[i - start + bufstart] = str.charCodeAt(i) & 0xff;
    },

    stringToArrayBuffer: function(str, start, end) {
      var self = this;

      if (end == undefined) end = str.length;
      if (start == undefined) start = 0;
      var res = new Uint8ClampedArray(end - start);
      self.writeStringToArrayBuffer(str, start, end, res, 0);
      return res.buffer;
    },

    arrayBuffer2String: function(buf) {
      return String.fromCharCode.apply(null, new Uint8Array(buf));
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

      self.events.triggerEvent("batch");
    },

    allLoaded: function () {
      var self = this;
      self.events.triggerEvent("all");
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
        self.headerLen = new DataView(self.stringToArrayBuffer(text, 0, 4)).getInt32(0, true);
        self.offset = 4;
      }
      if (length < self.offset + self.headerLen) return;
      if (!self._headerLoaded) {
        self.header = JSON.parse(text.substr(self.offset, self.headerLen));
          console.log(self.header);
        self.rowLen = 0;
        self.header.colsByName = {};
        for (var colidx = 0; colidx < self.header.cols.length; colidx++) {
          var col = self.header.cols[colidx];
          col.idx = colidx;
          self.header.colsByName[col.name] = col;
          col.typespec = TypedMatrixFormat.typemap[col.type];
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
      self.writeStringToArrayBuffer(text, self.offset, undefined, self.responseData);

      var dataView = new DataView(self.responseData.buffer);

      for (; self.offset + self.rowLen <= length; self.rowidx++) {
        var row = {};
        for (var colidx = 0; colidx < self.header.cols.length; colidx++) {
          var col = self.header.cols[colidx];
          var val = dataView[col.typespec.method](self.offset, true);
          if (col.multiplier != undefined) val = val * col.multiplier;
          if (col.offset != undefined) val = val + col.offset;
          row[col.name] = val;
          self.offset += col.typespec.size;
        }
        self.rowLoaded(row);
      }
      if (self.rowidx == self.header.length) {
        self.allLoaded();
        return true;
      } else {
        self.batchLoaded();
      }
    }
  });

  TypedMatrixFormat.typemap = {
    'Int32': {'size': Int32Array.BYTES_PER_ELEMENT, 'array': Float32Array, 'method': 'getInt32'},
    'Float32': {'size': Float32Array.BYTES_PER_ELEMENT, 'array': Float32Array, 'method': 'getFloat32'},
  };

  return TypedMatrixFormat;
});
