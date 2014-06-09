define(["app/Class", "app/Data/Format", "app/Data/BaseTiledFormat", "app/Data/EmptyFormat"], function(Class, Format, BaseTiledFormat, EmptyFormat) {
  var TiledEmptyFormat = Class(BaseTiledFormat, {
    name: "TiledEmptyFormat",

    load: function () {
      var self = this;
      if (self.error) {
        /* Rethrow error, to not confuse code that expects either an
         * error or a load event... */
        self.events.triggerEvent("error", self.error);
        return;
      }
      self.events.triggerEvent("load");

      self.tilesetHeader = {length: 0, colsByName: {}};
      self.mergeTiles();
      self.events.triggerEvent("header", self.tilesetHeader);
    },

    addContentToTile: function (tile) {
      var self = this;
      tile.content = new EmptyFormat({url:self.url + "/" + tile.bounds.toBBOX()});
      tile.content.setHeaders(self.headers);
    },

    toJSON: function () {
      return {
        type: self.name,
        args: {
          url: self.url
        }
      }
    }
  });
  Format.formatClasses.TiledEmptyFormat = TiledEmptyFormat;

  return TiledEmptyFormat;
});
