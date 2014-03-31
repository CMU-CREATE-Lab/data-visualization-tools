#! /usr/bin/env python
import sys
import json
import struct
import datetime
import dateutil.parser

if len(sys.argv) < 3:
    print """Usage:
json-to-bin.py data.json data.bin
json-to-bin.py data.json header.json data.bin

Data must contain a top-level array of objects.
Header must contain a top-level object.
"""
    sys.exit(1)

datafile = sys.argv[1]
headerfile = None
if len(sys.argv) > 3:
    headerfile = sys.argv[2]
outfile = sys.argv[-1]

header = {}
if headerfile:
    print "Reading header..."
    with open(headerfile) as f:
        header = json.load(f)

print "Reading data..."
with open(datafile) as f:
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
nrseries = 0;
series = lambda : 1 # Not equal to anything that you can find in a json
for i, d in enumerate(data):
    if d.get('series', None) != series:
        nrseries += 1;
        series = d.get('series', None)
    for key, value in d.iteritems():
        if value == '__None__' or value is None: continue
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
header.update({'cols': cols, 'length': len(data), 'series': nrseries})

print "Header: ", header
headerstr = json.dumps(header)
print "Header length: ", len(headerstr)

print "Writing data..."

with open(outfile, "w") as f:
    f.write(struct.pack("<i", len(headerstr)))
    f.write(headerstr)

    formatmap = '<' + ''.join(typeformatmap[col['type']] for col in cols)
    colspecs = [{'name': col['name'], 'type': coltypes[col['name']], 'default': typedefaultmap[col['type']]} for col in cols]

    for d in data:
        f.write(struct.pack(
                formatmap,
                *[conv(d[colspec['name']], colspec['type'], colspec['default'])
                  for colspec in colspecs]))
