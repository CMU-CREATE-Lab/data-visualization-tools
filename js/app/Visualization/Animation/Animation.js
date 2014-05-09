define(["app/Class", "app/Visualization/Shader", "app/Visualization/GeoProjection", "app/Data/DataView", "app/Visualization/DataViewUI"], function(Class, Shader, GeoProjection, DataView, DataViewUI) {
  var Animation = Class({
    name: "Animation",
    columns: {
      point: {type: "Float32", items: [
        {name: "latitude", source: {latitude: 1.0}},
        {name: "longitude", source: {longitude: 1.0}}]},
      color: {type: "Float32", items: [
        {name: "red", source: {_: 1.0}},
        {name: "green", source: {_: 1.0}},
        {name: "blue", source: {_: 0.0}}]},
      magnitude: {type: "Float32", items: [
        {name: "magnitude", source: {_: 1.0}}]}
    },

    initialize: function(manager) {
      var self = this;
      self.manager = manager;
      self.data_view = new DataView(self.manager.visualization.data.format, self.columns);
      self.data_view_ui = new DataViewUI(self.data_view);

      $('#map-div').mousemove(function (e) {
        self.select(e.offsetX, e.offsetY, 'hover', true);
      });
    },

    initGl: function(gl, cb) {
      var self = this;
      self.gl = gl;
      self.rowidxCanvas = document.createElement('canvas');
      var rowidxCanvas = $(self.rowidxCanvas);
      rowidxCanvas.css({position: "absolute", left:0, top: 0, width: "100%", height: "100%", "z-index": 1000, background: "black"});
      $("body").append(rowidxCanvas);

      self.rowidxGl = self.rowidxCanvas.getContext('experimental-webgl');
      self.rowidxGl.enable(self.rowidxGl.BLEND);
      self.rowidxGl.blendFunc(self.rowidxGl.ONE, self.gl.ONE);
      cb();
    },

    initUpdates: function(cb) {
      var self = this;
      self.data_view.events.on({
        "update": self.updateData.bind(self),
      });
      self.updateData();
      cb();
    },

    updateData: function () {
      var self = this;
      self.manager.triggerUpdate();
    },

    draw: function () {
      var self = this;
      var width = self.manager.canvasLayer.canvas.width;
      var height = self.manager.canvasLayer.canvas.height;
      self.rowidxGl.viewport(0, 0, width, height);
    },

    createDataViewArrayBuffers: function (program, columns) {
      var self = this;
      program.dataViewArrayBuffers = {};
      columns.map(function (name) {
        program.dataViewArrayBuffers[name] = program.gl.createBuffer();
      });
    },

    loadDataViewArrayBuffers: function(program) {
      var self = this;
      program.gl.useProgram(program);

      for (var name in program.dataViewArrayBuffers) {
        Shader.programLoadArray(program.gl, program.dataViewArrayBuffers[name], self.data_view.data[name], program);
      };
    },

    bindDataViewArrayBuffers: function(program) {
      var self = this;
      program.gl.useProgram(program);
      for (var name in program.dataViewArrayBuffers) {
        Shader.programBindArray(program.gl, program.dataViewArrayBuffers[name], program, name, self.data_view.header.colsByName[name].items.length, self.gl.FLOAT);
      };
    },

    setGeneralUniforms: function (program) {
      var self = this;
      var time = self.manager.visualization.state.getValue("time");
      var offset = self.manager.visualization.state.getValue("offset");

      if (time == undefined) return;
      time = time.getTime();

      // pointSize range [5,20], 21 zoom levels
      var pointSize = Math.max(
        Math.floor( ((20-5) * (self.manager.map.zoom - 0) / (21 - 0)) + 5 ),
        GeoProjection.getPixelDiameterAtLatitude(self.manager.visualization.state.getValue("resolution") || 1000, self.manager.map.getCenter().lat(), self.manager.map.zoom));

      program.gl.uniform1f(program.uniforms.pointSize, pointSize*1.0);
      program.gl.uniformMatrix4fv(program.uniforms.mapMatrix, false, self.manager.mapMatrix);
      program.gl.uniform1f(program.uniforms.startTime, time - offset * 24 * 60 * 60 * 1000);
      program.gl.uniform1f(program.uniforms.endTime, time);
    },

    /* Uses the rowidxGl canvas to get a source data rowid from a
     * pixel x/y position. Rowidx is encoded into RGB (in that order),
     * with 1 added to the rowidx. 0 encodes no row drawn on that
     * pixel. */
    getRowidxAtPos: function (x, y) {
      var self = this;

      var data = new Uint8Array(4);
      self.rowidxGl.readPixels(x, y, 1, 1, self.rowidxGl.RGBA, self.rowidxGl.UNSIGNED_BYTE, data);

      var res = (data[0] << 16 | data[1] << 8 | data[2]) - 1;
      if (res == -1) res = undefined;
      return res;
    },

    select: function (x, y, type, replace) {
      var self = this;
      var rowidx = self.getRowidxAtPos(x, y);

      console.log(["select", rowidx, x, y, type]);

      if (replace) {
        self.data_view.selections[type].clearRanges();
      }
      if (rowidx != undefined) {
        self.data_view.selections[type].addRange(self.data_view.source, rowidx);
      }
    }
  });

  Animation.animationClasses = {};

  return Animation;
});
