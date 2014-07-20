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

        self.animationManager.visualization.data.listSources(function (sources) {
          self.animationManager.visualization.data.listSourceTypes(function (sourceTypes) {

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
                sources.map(function (source) {
                  return {label:source.type + ": " + source.args.url, value:source};
                })
              )
            });
            dialog.addChild(sourceselect);

            var sourcetypeselect = new Select({
              name: "sourcetypeselect",
              options: sourceTypes.map(function (type) {
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
          });
        });
      },

      generateUI: function () {
        var self = this;

        self.ui = new ContentPane({content:"", doLayout: false});

        var state = self.animationManager.visualization.state;
        if (!state.getValue('title')) {
          state.setValue('title', "VectorVisual");
        }

        var header = new ContentPane({
          content: "<span class='title'><input type='text' style='display: none' class='input'></input><span class='text'>" + state.getValue('title') + "</span></span> <a href='javascript:void(0);' class='add'><i class='fa fa-plus-square'></i></a>",
          style: "padding-top: 0; padding-bottom: 0;"
        });
        var add = $(header.domNode).find("a.add");
        var title = $(header.domNode).find(".title");
        state.events.on({
          title: function () {
            var val = state.getValue('title');
            title.find('.input').val(val);
            title.find('.text').html(val);
          }
        });
        title.click(function () {
          title.find('.input').show();
          title.find('.input').focus();
          title.find('.text').hide();
        });
        var editEnd = function () {
          state.setValue('title', title.find('.input').val());
          title.find('.input').hide();
          title.find('.text').show();
        };
        title.find('.input').keypress(function (e) {
          if (event.which == 13) {
            editEnd();
            event.preventDefault();
          }
        });
        title.find('.input').blur(editEnd);
        add.click(function () {
          self.addAnimationDialog(add[0]);
        });
        self.ui.addChild(header);

        self.animationManager.animations.map(self.generateAnimationUI.bind(self));

        self.dialog.addChild(self.ui);
      },

      generateAnimationUI: function (animation) {
        var self = this;

        if (!animation.title) animation.title = animation.toString();

        var content = new ContentPane({content: animation.toString()});
        if (animation.data_view) {
          content.addChild(new DataViewUI(animation.data_view).ui);
        }

        var remove_btn_html = " <a href='javascript:void(0);' class='remove'><i class='fa fa-minus-square'></i></a>";
        if (animation.hideremovebtn) remove_btn_html = "";
        var header = new ContentPane({
          content: "<a class='expander'><i class='fa fa-chevron-right'></i></a> <input class='visible' type='checkbox'></input> <span class='title'><input type='text' style='display: none' class='input'></input><span class='text'>" + animation.title + "</span></span>" + remove_btn_html,
          style: "padding-top: 0; padding-bottom: 0px; padding-left: 2px;"
        });
        var expander = $(header.domNode).find(".expander");
        var visible = $(header.domNode).find(".visible");
        var remove = $(header.domNode).find(".remove");
        var title = $(header.domNode).find(".title");

        expander.click(function () {
          var expand = !expander.find('i').hasClass('fa-chevron-down');
          if (expand) {
            expander.find('i').addClass('fa-chevron-down');
            expander.find('i').removeClass('fa-chevron-right');
          } else {
            expander.find('i').addClass('fa-chevron-right');
            expander.find('i').removeClass('fa-chevron-down');
          }
          $(content.domNode).toggle(expand);
        });
        $(content.domNode).hide();

        visible.change(function () {
          animation.setVisible(visible.is(':checked'));
        });
        if (animation.visible) {
          visible.attr('checked','checked');
        } else {
          visible.removeAttr('checked');
        }
        remove.click(function () {
          self.animationManager.removeAnimation(animation);
        });
        title.click(function () {
          title.find('.input').show();
          title.find('.input').val(animation.title);
          title.find('.input').focus();
          title.find('.text').hide();
        });
        var editEnd = function () {
          animation.title = title.find('.input').val();
          title.find('.text').html(animation.title);
          title.find('.input').hide();
          title.find('.text').show();
        };
        title.find('.input').keypress(function (e) {
          if (event.which == 13) {
            editEnd();
            event.preventDefault();
          }
        });
        title.find('.input').blur(editEnd);

        var widget = new ContentPane({style: "padding-top: 0; padding-bottom: 0px; padding-left: 2px;"});
        widget.addChild(header);
        widget.addChild(content);
        animation.animationManagerWidget = widget;

        self.ui.addChild(widget);
      }
    });
  });
}
