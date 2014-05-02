define([
    "app/Class",
    "app/Logging",
    "jQuery",
    "dijit/Fieldset",
    "dijit/form/HorizontalSlider",
    "dojox/layout/FloatingPane",
    "dijit/layout/ContentPane",
    "dojo/dom",
    "dojo/parser",
    "dojo/domReady!"
], function(Class, Logging, $, Fieldset, HorizontalSlider, FloatingPane, ContentPane){
  return Class({
    name: "dataViewUI",
    initialize: function (dataview) {
      var self = this;

      self.dataview = dataview;

      dataview.events.on({
        scope: self
      });

      self.dialog = new FloatingPane({
        title: "DataViewUI",
        resizable: true,
        dockable: true,
        style: "position: absolute"
      });
      self.dialog.placeAt($("body")[0]);
      self.dialog.resize({x:10, y:10, w:300, h:400});

      self.dialog.addChild(self.generateUI());
      self.dialog.startup();
      self.dialog.show();
    },

    generateUI: function () {
      var self = this;

      var ui = new ContentPane();

      Object.values(self.dataview.header.colsByName).map(function (spec) {
        spec.items.map(function (item) {
          Object.items(item.source).map(function (source) {
            var content_pane = new ContentPane({content: spec.name + "." + item.name + " <- " + source.key});
            content_pane.addChild(new HorizontalSlider({
              name: source.key,
              value: source.value,
              minimum: -1.0,
              maximum: 1.0,
              intermediateChanges: true,
              style: "width:200px;",
              onChange: function (value) {
                Logging.default.log(
                  "DataViewUI." + spec.name + "." + item.name + "." + source.key,
                  {
                    toString: function () {
                      return this.column + "." + this.item + " = " + this.value + " * " + this.source;
                    },
                    column: spec.name,
                    item: item.name,
                    value: value,
                    source: source.key
                  }
                );                    
                item.source[source.key] = value;
                self.dataview.changeCol(spec);
              }
            }));
            ui.addChild(content_pane);
          });
        });
      });

      return ui;
    }
  });
});