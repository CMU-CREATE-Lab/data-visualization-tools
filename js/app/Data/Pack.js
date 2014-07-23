/* This class provides utility functions to pack/unpack data into
 * binary ordinary javascript strings. We use strings as ArrayBuffer
 * support in Ajax calls is still patchy, especially for streaming.
 *
 * writeStringToArrayBuffer / stringToArrayBuffer and
 * arrayBufferToString does this mangling, and their implementation
 * should be considered "a hack".
 *
 * The class also provides a set of type descriptors, indexed by name
 * and by array type, and functions that use these type descriptors to
 * parse/generate binary data. The type descriptors contain the size
 * of the binary representation, the array class, and the name of the
 * getter and setter methods for the type on a DataView instance.
 *
 * The pack() method can be used to encode data into a string using a
 * typespec.
 */

define(["app/Class"], function (Class) {
  var byname = {
    Int32: {
      size: Int32Array.BYTES_PER_ELEMENT,
      array: 'Int32Array',
      getter: 'getInt32',
      setter: 'setInt32'
    },
    Float32: {
      size: Float32Array.BYTES_PER_ELEMENT,
      array: 'Float32Array',
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
