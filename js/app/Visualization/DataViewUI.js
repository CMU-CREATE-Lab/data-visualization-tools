define([
    "app/Class",
    "jQuery",
    "dijit/Fieldset",
    "dijit/form/HorizontalSlider",
    "dijit/Dialog",
    "dojo/dom",
    "dojo/parser",
    "dojo/domReady!"
], function(Class, $, Fieldset, HorizontalSlider, Dialog){
  return Class({
    name: "dataViewUI",
    initialize: function (dataview) {
      var self = this;

      self.dataview = dataview;

      dataview.events.on({
        scope: self
      });

      var dialog = new Dialog({
        title: "DataViewUI",
        style: "width: 300px"
      });

      dialog.addChild(self.generateUI());

      dialog.show();
    },

    generateUI: function () {
      var self = this;

      var fieldset = new Fieldset({title: "DataView"});

      Object.values(self.dataview.header.colsByName).map(function (spec) {
        var col_fieldset = new Fieldset({title: spec.name});
        fieldset.addChild(col_fieldset);

        spec.items.map(function (item) {
          var item_fieldset = new Fieldset({title: item.name});
          col_fieldset.addChild(item_fieldset);

          Object.items(item.source).map(function (source) {
            item_fieldset.addChild(new HorizontalSlider({
              name: source.key,
              value: source.value,
              minimum: -1.0,
              maximum: 1.0,
              intermediateChanges: true,
              style: "width:100px;",
              onChange: function (value) {
                console.log([item.name, source.key, value]);
                item.source[source.key] = value;
                self.dataview.changeCol(spec);
              }
            }));
          });
        });
      });

      return fieldset;
    }
  });
});