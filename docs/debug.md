= Logging =
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

== Rule semantics ==

A ruleset is a mapping from a logging destination to a configuration.
The configuration contains a rule list. Each item in the list is a
dot-separated path to include in the logging, or exclude if prefixed
by '-'. More specific rules (longer paths) override more generic rules
(shorter paths).


= Tiles =
To debug tile loading:

    visualization.data.sources["TiledBinFormat|http://localhost:8000/tiles/tiledata3"].source.printTree()
