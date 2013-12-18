import sys
import json
import struct
import datetime
import dateutil.parser

with open(sys.argv[1]) as f:
    data = json.load(f)

with open(sys.argv[2], "w") as f:
    for d in data:
        f.write(struct.pack(
                "<fffffii",
                float(d["latitude"]),
                float(d["longitude"]),
                float(d["RadiantOutput"]),
                float(d["RadiativeHeat"]),
                float(d["footprint"]),
                int(d["Temperature"]),
                int(dateutil.parser.parse(d["datetime"]).strftime("%s"))
                ))
