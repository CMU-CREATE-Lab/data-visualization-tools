import sys
import json
import struct
import datetime
import dateutil.parser

with open(sys.argv[1]) as f:
    data = json.load(f)

def conv(data, t, default):
    try:
        return t(data)
    except:
        return default

with open(sys.argv[2], "w") as f:
    for d in data:
        f.write(struct.pack(
                "<fffffii",
                conv(d["latitude"], float, 0.0),
                conv(d["longitude"], float, 0.0),
                conv(d["RadiantOutput"], float, 0.0),
                conv(d["RadiativeHeat"], float, 0.0),
                conv(d["footprint"], float, 0.0),
                conv(d["Temperature"], int, 0),
                int(conv(d["datetime"], dateutil.parser.parse, 0).strftime("%s"))
                ))
