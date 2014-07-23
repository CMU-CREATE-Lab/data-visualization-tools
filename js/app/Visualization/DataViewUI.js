if (!app.useDojo) {
  define(["app/Class"], function (Class) {
    return Class({name: "DataViewUI"});
  });
} else {
  define([
    "app/Class",
    "app/Logging",
    "jQuery",
    "dijit/Fieldset",
    "dijit/form/HorizontalSlider",
    "dojox/layout/FloatingPane",
    "dijit/layout/ContentPane",
    "dijit/Fieldset",
    "dijit/Menu",
    "dijit/MenuItem",
    "dijit/popup",
    "dojo/dom",
    "dojo/parser",
    "dojo/domReady!"
  ], function(Class, Logging, $, Fieldset, HorizontalSlider, FloatingPane, ContentPane, Fieldset, Menu, MenuItem, popup){
    return Class({
      name: "DataViewUI",
      initialize: function (dataview) {
        var self = this;

        self.dataview = dataview;

        self.generateUI();
      },

      generateSourceUI: function (itemwidget, spec, item, source) {
        var self = this;

        self.dataview.useHeader(function (header, cb) {
          var sourcespec = header.colsByName[source.key];
          var min = -1.0;
          var max = 1.0;
          if (item.min != undefined && item.max != undefined) {
            if (sourcespec != undefined && sourcespec.min != undefined && sourcespec.max != undefined) {
              max = item.max / sourcespec.max;
              min = -item.max / sourcespec.max;
            } else {
              min = -item.max;
              max = item.max;
            }
          }
          var label = "[Constant value]";
          if (source.key != "_") label = source.key;

          var sourcewidget = new ContentPane({
            content: "<a href='javascript:void(0);' class='remove' style='float:left;'><i class='fa fa-minus-square'></i> " + label + "</a>",
            style: "padding-top: 0; padding-bottom: 8px;"
          });
          $(sourcewidget.domNode).find("a.remove").click(function () {
            delete item.source[source.key];
            sourcewidget.destroy();
          })
          Logging.default.log(
            "DataViewUI.source." + spec.name + "." + item.name + "." + source.key,
            {
              toString: function () {
                return this.column + "." + this.item + " [" + this.min + ", " + this.max + "] = " + this.value + " * " + this.source;
              },
              column: spec.name,
              item: item.name,
              min: min,
              max: max,
              value: source.value,
              source: source.key
            }
          );
          sourcewidget.addChild(new HorizontalSlider({
            name: source.key,
            value: source.value,
            minimum: min,
            maximum: max,
            intermediateChanges: true,
            style: "width:200px;",
            onChange: function (value) {
              Logging.default.log(
                "DataViewUI.set." + spec.name + "." + item.name + "." + source.key,
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
          itemwidget.addChild(sourcewidget);
          cb();
        });
      },

      generateUI: function () {
        var self = this;

        self.dataview.useHeader(function (header, cb) {

          var ui = new ContentPane({});

          Object.values(header.colsByName).map(function (spec) {
            if (spec.hidden) return;
            spec.items.map(function (item) {
              if (item.hidden) return;
              var itemwidget = new ContentPane({
                content: spec.name + "." + item.name + " <a href='javascript:void(0);' class='add'><i class='fa fa-plus-square'></i></a>",
                style: "padding-top: 0; padding-bottom: 0;"
              });
              $(itemwidget.domNode).find("a.add").click(function () {
                self.dataview.getAvailableColumns(function (err, availableColumns) {
                  var sourceselect = new Menu({
                    onMouseLeave: function () {
                      popup.close(sourceselect);
                    }
                  });
                  availableColumns.map(function (colname) {
                    sourceselect.addChild(new MenuItem({
                      label: colname,
                      onClick: function(evt) {
                        item.source[colname] = 0.0;
                        self.generateSourceUI(itemwidget, spec, item, {key:colname, value: 0.0});
                      }
                    }));
                  });
                  sourceselect.addChild(new MenuItem({
                    label: "[Constant value]",
                    onClick: function(evt) {
                      item.source["_"] = 0.0;
                      self.generateSourceUI(itemwidget, spec, item, {key:"_", value: 0.0});
                    }
                  }));
                  popup.open({
                    popup: sourceselect,
                    onExecute : function() { 
                      popup.close(sourceselect);
                    }, 
                    onCancel : function() { 
                      popup.close(sourceselect);
                    }, 
                    around: $(itemwidget.domNode).find("a.add")[0]
                  });
                });
              });
              Object.items(item.source).map(function (source) { self.generateSourceUI(itemwidget, spec, item, source); });
              ui.addChild(itemwidget);
            });
          });

          self.ui = ui;
        });
      }
    });
  });
}
