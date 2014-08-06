define(["app/Class", "async", "app/Visualization/Shader", "app/Data/GeoProjection", "app/Data/DataView", "app/Visualization/DataViewUI", "jQuery"], function(Class, async, Shader, GeoProjection, DataView, DataViewUI, $) {
  var Animation = Class({
    name: "Animation",
    columns: {
      point: {type: "Float32", transform: "coordinate", items: [
        {name: "latitude", source: {latitude: 1.0}},
        {name: "longitude", source: {longitude: 1.0}}]},
      color: {type: "Float32", items: [
        {name: "red", source: {_: 1.0}},
        {name: "green", source: {_: 1.0}},
        {name: "blue", source: {_: 0.0}}]},
      magnitude: {type: "Float32", items: [
        {name: "magnitude", source: {_: 1.0}}]}
    },

    programSpecs: {},

    initialize: function(manager, args) {
      var self = this;

      self.visible = true;
      if (args) $.extend(self, args);
      self.manager = manager;
    },

    setVisible: function (visible) {
      var self = this;
      self.visible = visible;
      self.manager.triggerUpdate();
    },

    handleError: function (error) {
      var self = this;
      self.manager.removeAnimation(self);
    },

    destroy: function () {
      var self = this;
      $(self.rowidxCanvas).remove();
    },

    initGl: function(gl, cb) {
      var self = this;

      self.manager.visualization.data.createView({
        source:self.source,
        columns: self.columns,
        selections: self.selections
      }, function (err, data_view) {
        if (err) throw err; // FIXME: Make cb handle cb(err);
        self.data_view = data_view;

        self.data_view.events.on({
          error: self.handleError.bind(self)
        });
        self.data_view.load();

        self.gl = gl;
        self.rowidxCanvas = document.createElement('canvas');

        rowidxCanvas = $(self.rowidxCanvas);
        self.rowidxGl = self.rowidxCanvas.getContext('experimental-webgl', {preserveDrawingBuffer: true});
        self.rowidxGl.enable(self.rowidxGl.BLEND);
        self.rowidxGl.blendFunc(self.rowidxGl.SRC_ALPHA, self.rowidxGl.ONE_MINUS_SRC_ALPHA);
        self.rowidxGl.lineWidth(1.0);

        self.initGlPrograms(cb);
      });
    },

    initGlPrograms: function(cb) {
      var self = this;

      self.programs = {};
      async.map(Object.items(self.programSpecs), function (item, cb) {
        Shader.createShaderProgramFromUrl(
          self[item.value.context],
          require.toUrl(item.value.vertex),
          require.toUrl(item.value.fragment),
          function (program) {
            program.name = item.key;
            self.programs[item.key] = program;
            self.createDataViewArrayBuffers(program, item.value.columns, item.value.items_per_source_item);
            cb();
          }
        );
      }, cb);
    },

    initUpdates: function(cb) {
      var self = this;
      self.data_view.events.on({
        "update": self.updateData.bind(self),
      });
      self.updateData();
      cb();
    },

    updateData: function() {
      var self = this;

      Object.values(self.programs).map(self.updateDataProgram.bind(self));

      self.manager.triggerUpdate();
    },

    updateDataProgram: function (program) {
      var self = this;
      self.loadDataViewArrayBuffers(program);
    },

    draw: function () {
      var self = this;
      if (!self.visible) return;

      var width = self.manager.canvasLayer.canvas.width;
      var height = self.manager.canvasLayer.canvas.height;
      self.rowidxCanvas.width = width;
      self.rowidxCanvas.height = height;

      self.rowidxGl.viewport(0, 0, width, height);
      self.rowidxGl.clear(self.rowidxGl.COLOR_BUFFER_BIT);

      Object.values(self.programs).map(self.drawProgram.bind(self));
    },

    drawProgram: function (program) {
      var self = this;

      self.bindDataViewArrayBuffers(program);
      self.setGeneralUniforms(program);

      var mode = self.getDrawMode(program);
      self.data_view.useSeries(function (series, cb) {
        // -1 since series contains POINT_COUNT in the last item
        for (var i = 0; i < series.length - 1; i++) {
          program.gl.drawArrays(
            mode,
            series[i]*program.items_per_source_item,
            (series[i+1]-series[i])*program.items_per_source_item
          );
        }
      });
    },

    createDataViewArrayBuffers: function (program, columns, items_per_source_item) {
      var self = this;
      program.dataViewArrayBuffers = {};
      program.items_per_source_item = items_per_source_item || 1;
      columns.map(function (name) {
        program.dataViewArrayBuffers[name] = program.gl.createBuffer();
      });
    },

    loadDataViewArrayBuffers: function(program) {
      var self = this;
      program.gl.useProgram(program);

      self.data_view.useData(function (data, cb) {
        for (var name in program.dataViewArrayBuffers) {
          Shader.programLoadArray(program.gl, program.dataViewArrayBuffers[name], data[name], program);
        };
        cb();
      });
    },

    bindDataViewArrayBuffers: function(program) {
      var self = this;
      program.gl.useProgram(program);
      self.data_view.useHeader(function (header, cb) {
        for (var name in program.dataViewArrayBuffers) {
          var col = header.colsByName[name];
          if (col) {
            Shader.programBindArray(program.gl, program.dataViewArrayBuffers[name], program, name, col.items.length / program.items_per_source_item, program.gl.FLOAT);
          }
        };
        cb();
      });
    },

    setGeneralUniforms: function (program) {
      var self = this;
      var time = self.manager.visualization.state.getValue("time");
      var timeExtent = self.manager.visualization.state.getValue("timeExtent");

      if (time == undefined) return;
      time = time.getTime();

      // pointSize range [5,20], 21 zoom levels
      var pointSize = Math.max(
        Math.floor( ((20-5) * (self.manager.map.zoom - 0) / (21 - 0)) + 5 ),
        GeoProjection.getPixelDiameterAtLatitude(self.manager.visualization.state.getValue("resolution") || 1000, self.manager.map.getCenter().lat(), self.manager.map.zoom));

      program.gl.uniform1f(program.uniforms.pointSize, pointSize*1.0);
      program.gl.uniformMatrix4fv(program.uniforms.mapMatrix, false, self.manager.mapMatrix);
      program.gl.uniform1f(program.uniforms.startTime, time - timeExtent);
      program.gl.uniform1f(program.uniforms.endTime, time);
    },

    /* Uses the rowidxGl canvas to get a source data rowid from a
     * pixel x/y position. Rowidx is encoded into RGB (in that order),
     * with 1 added to the rowidx. 0 encodes no row drawn on that
     * pixel. */
    getRowidxAtPos: function (x, y, radius) {
      var self = this;

      /* Canvas coordinates are upside down for some reason... */
      y = self.manager.canvasLayer.canvas.height - y;

      if (radius == undefined) radius = 4;

      var size = radius * 2 + 1;

      var data = new Uint8Array(4*size*size);
      self.rowidxGl.readPixels(x-radius, y-radius, size, size, self.rowidxGl.RGBA, self.rowidxGl.UNSIGNED_BYTE, data);

      var pixelToId = function (offset) {
        var res = ((data[offset] << 16) | (data[offset+1] << 8) | data[offset+2]) - 1;
        if (res == -1) res = undefined;
        return res;
      }

      var rowIdx = [];
      for (var i = 0; i < size*size; i++) {
        rowIdx.push(pixelToId(i * 4));
      }

      var last = undefined;
      var lastradius = 0;
      for (var oy = 0; oy < size; oy++) {
        for (var ox = 0; ox < size; ox++) {
          var r = Math.sqrt(Math.pow(Math.abs(ox - size + 0.5), 2) + Math.pow(Math.abs(oy - size + 0.5), 2))
          if (rowIdx[oy*size+ox] != undefined && (r <= lastradius || last == undefined)) {
            last = rowIdx[oy*size+ox];
            lastradius = r;
          }
        }
      }

      return last;
    },

    select: function (x, y, type, replace) {
      var self = this;
      var rowidx = self.getRowidxAtPos(x, y);
      self.data_view.addSelectionRange(type, rowidx, rowidx, replace);
      return rowidx;
    },

    toString: function () {
      var self = this;
      return self.name + ": " + self.data_view;
    },

    toJSON: function () {
      var self = this;
      var args = self.data_view.toJSON();
      args.title = self.title;
      args.visible = self.visible;
      args.source = self.source;
      return {
        args: args,
        type: self.name
      };
    }
  });

  Animation.animationClasses = {};

  return Animation;
});
