#! /usr/bin/env python
import sys
import argparse
import json
import datetime

if len(sys.argv) < 3:
    print """Usage:
tile-data.py conn=psycopg2 host=localhost user=scraper password=password database=dbname expr="query"
"""
    sys.exit(1)


args = dict([arg.split('=', 1) for arg in sys.argv[1:]])

expr = args.pop("expr")

limit = 10000
if 'limit' in args:
    limit = args.pop('limit')

granularity = '3 hours'
if 'granularity' in args:
    granularity = args.pop('granularity')

connector = "psycopg2"
if "conn" in args:
    connector = args['conn']
    del args['conn']

module = __import__(connector)
for name in connector.split('.')[1:]:
    module = getattr(module, name)

conn = module.connect(**args)
cur = conn.cursor()


class Bbox(object):
    def __init__(self, latmin=-90, latmax=90, lonmin=-180, lonmax=180):
        self.latmin=latmin
        self.latmax=latmax
        self.lonmin=lonmin
        self.lonmax=lonmax
    def __repr__(self):
        # left,bottom,right,top - all according to openlayers :)

        def f(v):
            res = str(v)
            if res.endswith(".0"):
                res = res[:-2]
            return res
        return "%s,%s,%s,%s" % (f(self.lonmin), f(self.latmin), f(self.lonmax), f(self.latmax))
    def children(self):
        height = float(self.latmax-self.latmin)
        width = float(self.lonmax-self.lonmin)
        return [
            Bbox(self.latmin, self.latmin+height/2, self.lonmin, self.lonmin+width/2),
            Bbox(self.latmin+height/2, self.latmax, self.lonmin, self.lonmin+width/2),
            Bbox(self.latmin+height/2, self.latmax, self.lonmin+width/2, self.lonmax),
            Bbox(self.latmin, self.latmin+height/2, self.lonmin+width/2, self.lonmax)]
    def sql(self):
        return "latitude >= %s and latitude < %s and longitude >= %s and longitude < %s" % (self.latmin, self.latmax, self.lonmin, self.lonmax)

def manglevalue(value):
    if isinstance(value, datetime.datetime):
        return float(value.strftime("%s"))
    return value

def manglerow(row):
    return (manglevalue(value) for value in row)

def dictreader(cur):
    cols = None
    for row in cur:
        if cols is None:
            cols = [dsc[0] for dsc in cur.description]
        yield dict(zip(cols, manglerow(row)))

def count_tile_content(bbox):
    cur.execute("""select count(*) from tiledata where %s""" % (bbox.sql(),))
    return cur.fetchone()[0]

def fetch_tile(bbox, indent):
    count = count_tile_content(bbox)
    print indent + "  Count: %s" % count

    if count == 0:
        return {'rows': [], 'complete': True}
    elif count < limit:
        cur.execute("select * from tiledata where %s order by datetime" % (bbox.sql(),))
        return {'rows': [row for row in dictreader(cur)], 'complete': True}
    else:
        q = "select * from (select * from tiledata where %s order by rnd limit %s) y order by datetime asc" % (bbox.sql(), limit)
        print indent + "  " + q
        cur.execute(q)
        return {'rows': [row for row in dictreader(cur)], 'complete': False}

def write_tile(bbox, tile):
    with open("%s.json" % (bbox,), "w") as f:
        json.dump(tile['rows'], f)

def make_tiles(bbox = Bbox(), indent = ''):
    print indent + "Making %s..." % (bbox,)
    tile = fetch_tile(bbox, indent)
    write_tile(bbox, tile)
    if not tile['complete']:
        print indent + "  Not complete"
        for child in bbox.children():
            make_tiles(child, indent + '  ')

print "Creating temp table..."
cur.execute("create temporary table tiledata as %s" % expr)
print "Adding random order..."
cur.execute("alter table tiledata add column rnd float")
cur.execute("update tiledata set rnd=random()")
print "Creating indexes..."
cur.execute("create index tiledata_lat on tiledata(latitude)")
cur.execute("create index tiledata_lon on tiledata(longitude)")
cur.execute("create index tiledata_datetime on tiledata(datetime)")
cur.execute("create index tiledata_rnd on tiledata(rnd)")
cur.execute("create index tiledata_all on tiledata(latitude, longitude, rnd, datetime)")

make_tiles()
