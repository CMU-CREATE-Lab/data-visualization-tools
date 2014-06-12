Add this to workspace to activate logging

    "state": {
        "logging": {
          "screen": {"rules": ["all", "-Data.Format.row"]}
        }
    },

From the javascript console:

    Logging = require("app/Logging");
    Logging.default.setRules({
        "screen": {"rules": ["all", "-Data.Format.row"]}
    });

Zoomto event:

    Logging.default.setRules({"screen": {"rules": ["Data.BaseTiledFormat.zoomTo"]}});

To debug tile loading:

    visualization.data.sources["TiledBinFormat|http://localhost:8000/tiles/tiledata3"].source.printTree()
