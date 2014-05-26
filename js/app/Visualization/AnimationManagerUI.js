if (!app.useDojo) {
  define(["app/Class"], function (Class) {
    return Class({name: "VisualizationUI"});
  });
} else {
  define([
    "app/Class",
    "app/Logging",
    "app/Visualization/DataViewUI",
    "jQuery",
    "dijit/Fieldset",
    "dojox/layout/FloatingPane",
    "dijit/layout/ContentPane",
    "dijit/Menu",
    "dijit/MenuItem",
    "dijit/popup",
    "dojo/dom",
    "dojo/parser",
    "dojo/domReady!"
  ], function(Class, Logging, DataViewUI, $, Fieldset, FloatingPane, ContentPane, Menu, MenuItem, popup){
    return Class({
      name: "VisualizationUI",
      initialize: function (animationManager) {
        var self = this;

        self.animationManager = animationManager;

        self.dialog = new FloatingPane({
          title: "VisualizationUI",
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

        self.animationManager.animations.map(function (animation) {
          var dataView = new DataViewUI(animation.data_view);
          ui.addChild(dataView.ui);
        });

        return ui;
      }
    });
  });
}
