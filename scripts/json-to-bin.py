#! /usr/bin/env python
import sys
import json
import struct
import datetime
import dateutil.parser

print "Reading data..."
with open(sys.argv[1]) as f:
    data = json.load(f)

def timestamp(data):
    return int(dateutil.parser.parse(data).strftime("%s"))

def conv(data, t, default):
    try:
        return t(data)
    except:
        return default

typemap = {
    timestamp: 'Int32',
    int: 'Int32',
    float: 'Float32',
    }

typeformatmap = {
    'Int32': 'i',
    'Float32': 'f'
    }
typedefaultmap = {
    'Int32': 0,
    'Float32': 0.0
    }

print "Calculating header values..."

datalen = len(data)
cols = {}
coltypes = {}
for i, d in enumerate(data):
    for key, value in d.iteritems():
        if value == '__None__': continue
        t = type(value)
        if t is str or t is unicode:
            # If it's clearly not a date, avoid the time to throw and exception...
            if not value or value[0] not in '0123456789': continue
            try:
                value = timestamp(value)
                t = timestamp
            except:
                continue
        if key not in cols:
            cols[key] = {'name': key, 'type': typemap[t], 'min': value, 'max': value}
            coltypes[key] = t
        cols[key]['max'] = max(cols[key]['max'], value)
        cols[key]['min'] = min(cols[key]['min'], value)
    if i % 1000 == 0:
        print "%.2f%%" % (100 * float(i) / datalen)

cols = cols.values()
cols.sort(lambda a, b: cmp(a['name'], b['name']))
header = {'cols': cols, 'length': len(data)}

print "Header: ", header
headerstr = json.dumps(header)
print "Header length: ", len(headerstr)

print "Writing data..."

with open(sys.argv[2], "w") as f:
    f.write(struct.pack("<i", len(headerstr)))
    f.write(headerstr)

    formatmap = '<' + ''.join(typeformatmap[col['type']] for col in cols)
    colspecs = [{'name': col['name'], 'type': coltypes[col['name']], 'default': typedefaultmap[col['type']]} for col in cols]

    for d in data:
        f.write(struct.pack(
                formatmap,
                *[conv(d[colspec['name']], colspec['type'], colspec['default'])
                  for colspec in colspecs]))
