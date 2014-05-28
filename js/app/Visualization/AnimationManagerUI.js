if (!app.useDojo) {
  define(["app/Class"], function (Class) {
    return Class({name: "VisualizationUI"});
  });
} else {
  define([
    "app/Class",
    "app/Logging",
    "app/Visualization/DataViewUI",
    "app/Visualization/Animation/Animation",
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
  ], function(Class, Logging, DataViewUI, Animation, $, Fieldset, FloatingPane, ContentPane, Menu, MenuItem, popup){
    return Class({
      name: "VisualizationUI",
      initialize: function (animationManager) {
        var self = this;

        self.animationManager = animationManager;
        self.animationManager.events.on({
          add: self.addHandler.bind(self),
          remove: self.removeHandler.bind(self),
        });

        self.dialog = new FloatingPane({
          title: "VisualizationUI",
          resizable: true,
          dockable: true,
          style: "position: absolute"
        });
        self.dialog.placeAt($("body")[0]);
        self.dialog.resize({x:10, y:10, w:400, h:500});

        self.generateUI();

        self.dialog.startup();
        self.dialog.show();
      },

      addHandler: function (event) {
        var self = this;
        self.generateAnimationUI(event.animation);
      },

      removeHandler: function (event) {
        var self = this;
        event.animation.animationManagerWidget.destroy();
      },

      generateUI: function () {
        var self = this;

        self.ui = new ContentPane({content:"", doLayout: false});

        var title = new ContentPane({
          content: "Animations <a href='javascript:void(0);' class='add'><i class='fa fa-plus-square'></i></a>",
          style: "padding-top: 0; padding-bottom: 0;"
        });
        $(title.domNode).find("a.add").click(function () {
          var typeselect = new Menu({
            onMouseLeave: function () {
              popup.close(typeselect);
            }
          });
          Object.items(Animation.animationClasses).map(function (item) {
            typeselect.addChild(new MenuItem({
              label: item.key,
              onClick: function(evt) {
                self.animationManager.addAnimation({type:item.key}, function (err, animation) {
                  self.generateAnimationUI(animation);
                });
              }
            }));
          });
          popup.open({
            popup: typeselect,
            onExecute : function() { 
              popup.close(typeselect);
            }, 
            onCancel : function() { 
              popup.close(typeselect);
            }, 
            around: $(title.domNode).find("a.add")[0]
          });
        });
        self.ui.addChild(title);

        self.animationManager.animations.map(self.generateAnimationUI.bind(self));

        self.dialog.addChild(self.ui);
      },

      generateAnimationUI: function (animation) {
        var self = this;

        var title = new ContentPane({
          content: "<a href='javascript:void(0);' class='remove' style='float:left;'><i class='fa fa-minus-square'></i> " + animation.name + "</a>",
          style: "padding-top: 0; padding-bottom: 8px;"
        });
        $(title.domNode).find("a.remove").click(function () {
          self.animationManager.removeAnimation(animation);
        })

        var widget = new ContentPane({});
        widget.addChild(title);
        widget.addChild(new DataViewUI(animation.data_view).ui);
        animation.animationManagerWidget = widget;

        self.ui.addChild(widget);
      }
    });
  });
}
