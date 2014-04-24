define(["Class"], function (Class) {
  var byname = {
    Int32: {
      size: Int32Array.BYTES_PER_ELEMENT,
      array: Int32Array,
      getter: 'getInt32',
      setter: 'setInt32'
    },
    Float32: {
      size: Float32Array.BYTES_PER_ELEMENT,
      array: Float32Array,
      getter: 'getFloat32',
      setter: 'setFloat32'
    }
  };

  var Pack = Class({});

  Pack.writeStringToArrayBuffer = function(str, start, end, buf, bufstart) {
    if (end == undefined) end = str.length;
    if (start == undefined) start = 0;
    if (bufstart == undefined) bufstart = start;
    for (var i = start; i < end; i++) buf[i - start + bufstart] = str.charCodeAt(i) & 0xff;
  };

  Pack.stringToArrayBuffer = function(str, start, end) {
    var self = this;

    if (end == undefined) end = str.length;
    if (start == undefined) start = 0;
    var res = new Uint8ClampedArray(end - start);
    self.writeStringToArrayBuffer(str, start, end, res, 0);
    return res.buffer;
  };

  Pack.arrayBufferToString = function(buf) {
    return String.fromCharCode.apply(null, new Uint8Array(buf));
  };

  Pack.pack = function(typespec, value, littleendian) {
    var array = new ArrayBuffer(typespec.size);
    new DataView(array)[typespec.setter](0, value, littleendian);
    return Pack.arrayBufferToString(array);
  };

  Pack.typemap = {byname: byname, byarray: {}};
  for (var name in Pack.typemap.byname) {
    var spec = Pack.typemap.byname[name];
    spec.name = name;
    Pack.typemap.byarray[spec.array] = spec;
  }

  return Pack;
});
