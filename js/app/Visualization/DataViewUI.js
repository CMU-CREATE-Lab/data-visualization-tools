if (!useDojo) {
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
    "dijit/Menu",
    "dijit/MenuItem",
    "dijit/popup",
    "dojo/dom",
    "dojo/parser",
    "dojo/domReady!"
  ], function(Class, Logging, $, Fieldset, HorizontalSlider, FloatingPane, ContentPane, Menu, MenuItem, popup){
    return Class({
      name: "DataViewUI",
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

      generateSourceUI: function (itemwidget, spec, item, source) {
        var self = this;

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
        sourcewidget.addChild(new HorizontalSlider({
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
        itemwidget.addChild(sourcewidget);
      },

      generateUI: function () {
        var self = this;

        var ui = new ContentPane();

        Object.values(self.dataview.header.colsByName).map(function (spec) {
          spec.items.map(function (item) {
            var itemwidget = new ContentPane({
              content: spec.name + "." + item.name + " <a href='javascript:void(0);' class='add'><i class='fa fa-plus-square'></i></a>",
              style: "padding-top: 0; padding-bottom: 0;"
            });
            $(itemwidget.domNode).find("a.add").click(function () {
              var sourceselect = new Menu({
                onMouseLeave: function () {
                  popup.close(sourceselect);
                }
              });
              Object.keys(self.dataview.source.header.colsByName).map(function (colname) {
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
            Object.items(item.source).map(function (source) { self.generateSourceUI(itemwidget, spec, item, source); });
            ui.addChild(itemwidget);
          });
        });

        return ui;
      }
    });
  });
}