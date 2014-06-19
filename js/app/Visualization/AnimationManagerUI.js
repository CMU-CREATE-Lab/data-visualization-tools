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
    "dijit/TooltipDialog",
    "dijit/form/Select",
    "dijit/form/TextBox",
    "dijit/form/Button",
    "dijit/popup",
    "dojo/dom",
    "dojo/parser",
    "dojo/domReady!"
  ], function(Class, Logging, DataViewUI, Animation, $, Fieldset, FloatingPane, ContentPane, Menu, MenuItem, TooltipDialog, Select, TextBox, Button, popup){
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

      addAnimationDialog: function (domNode) {
        var self = this;
        var dialog = new TooltipDialog({title: "Add animation:"});

        var typeselect = new Select({
          name: "typeselect",
          options: Object.items(Animation.animationClasses).map(function (item) {
            return {label:item.key, value:item.key};
          })
        });
        dialog.addChild(typeselect);

        var sourceselect = new Select({
          name: "sourceselect",
          options: [{label:"New", value:null}].concat(
            self.animationManager.visualization.data.listSources().map(function (source) {
              return {label:source.type + ": " + source.args.url, value:source};
            })
          )
        });
        dialog.addChild(sourceselect);

        var sourcetypeselect = new Select({
          name: "sourcetypeselect",
          options: self.animationManager.visualization.data.listSourceTypes().map(function (type) {
            return {label:type, value:type};
          })
        });
        dialog.addChild(sourcetypeselect);

        var urlbox = new dijit.form.TextBox({
          name: "url",
          value: "",
          placeHolder: "Data source URL"
        });
        dialog.addChild(urlbox);

        var addbutton = new Button({
          label: "Add",
          onClick: function(){
            var type = typeselect.get('value');
            var source = sourceselect.get('value');
            if (!source) {
              source = {type:sourcetypeselect.get('value'), args: {url:urlbox.get('value')}};
            }
            self.animationManager.addAnimation({type:type, args: {source: source}}, function (err, animation) {});
            dialog.onExecute();
          }
        });
        dialog.addChild(addbutton);

        var cancelbutton = new Button({
          label: "Cancel",
          onClick: function(){
            dialog.onCancel();
          }
        });
        dialog.addChild(cancelbutton);

        popup.open({
          popup: dialog,
          onExecute : function() { 
            popup.close(dialog);
            dialog.destroy();
          }, 
          onCancel : function() { 
            popup.close(dialog);
            dialog.destroy();
          }, 
          onClose : function() { 
            popup.close(dialog);
            dialog.destroy();
          }, 
          around: domNode
        });
      },

      generateUI: function () {
        var self = this;

        self.ui = new ContentPane({content:"", doLayout: false});

        var title = new ContentPane({
          content: "Animations <a href='javascript:void(0);' class='add'><i class='fa fa-plus-square'></i></a>",
          style: "padding-top: 0; padding-bottom: 0;"
        });
        $(title.domNode).find("a.add").click(function () {
          self.addAnimationDialog($(title.domNode).find("a.add")[0]);
        });
        self.ui.addChild(title);

        self.animationManager.animations.map(self.generateAnimationUI.bind(self));

        self.dialog.addChild(self.ui);
      },

      generateAnimationUI: function (animation) {
        var self = this;

        if (!animation.title) animation.title = animation.toString();
        var header = new ContentPane({
          content: "<input class='visible' type='checkbox'></input> <span class='title'><input type='text' style='display: none' class='input'></input><span class='text'>" + animation.title + "</span></span> <a href='javascript:void(0);' class='remove'><i class='fa fa-minus-square'></i></a>",
          style: "padding-top: 0; padding-bottom: 8px;"
        });
        var visible = $(header.domNode).find(".visible");
        var remove = $(header.domNode).find(".remove");
        var title = $(header.domNode).find(".title");
        visible.change(function () {
          animation.setVisible(visible.is(':checked'));
        });
        remove.click(function () {
          self.animationManager.removeAnimation(animation);
        });
        title.click(function () {
          title.find('.input').show();
          title.find('.input').val(animation.title);
          title.find('.text').hide();
        });
        title.find('.input').keypress(function (e) {
          if (event.which == 13) {
            animation.title = title.find('.input').val();
            title.find('.text').html(animation.title);
            title.find('.input').hide();
            title.find('.text').show();
            event.preventDefault();
          }
        });

        if (animation.visible) {
          visible.attr('checked','checked');
        } else {
          visible.removeAttr('checked');
        }

        var widget = new ContentPane({});
        widget.addChild(header);
        if (animation.data_view) {
          widget.addChild(new DataViewUI(animation.data_view).ui);
        }
        animation.animationManagerWidget = widget;

        self.ui.addChild(widget);
      }
    });
  });
}
