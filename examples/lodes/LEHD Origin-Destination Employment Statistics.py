#!/usr/bin/env python
import array
import math
import psycopg2
from random import uniform
from shapely.geometry import *
from shapely.wkb import loads
from TileStache.Goodies.VecTiles.ops import transform

def LonLatToPixelXY(lonlat, scale = 1.):
    (lon, lat) = lonlat
    x = (lon + 180.0) * 256.0 / 360.0
    y = 128.0 - math.log(math.tan((lat + 90.0) * math.pi / 360.0)) * 128.0 / math.pi
    return [x*scale, y*scale]

rows = []
conn = psycopg2.connect("dbname=lodes_tl_2010")
cur = conn.cursor()
query = "SELECT ST_Transform(work.geom,4326), ST_Transform(home.geom,4326), ST_Distance_Sphere(ST_Transform(ST_Centroid(work.geom),4326), ST_Transform(ST_Centroid(home.geom),4326)), pa.s000, pa.se01, pa.se02, pa.se03 FROM pa_od_main_jt00_2011 pa, tl_2010_42_tabblock10 work,tl_2010_42_tabblock10 home WHERE pa.w_geocode = work.geoid10 AND pa.h_geocode = home.geoid10"
cur.execute(query)
rows = cur.fetchall()
cur.close()
conn.close()

print "Query finished..."

def randomPoint(geom):
    poly = loads(geom, True)
    bbox = poly.bounds
    l,b,r,t = bbox
    while True:
        point = Point(uniform(l,r),uniform(t,b))
        if point is None:
            break
        if poly.contains(point):
            break
    return point.__geo_interface__['coordinates']

data = []
pp = 0
for row in rows:
    workGeom = row[0]
    homeGeom = row[1]
    distance = row[2]
    total = row[3]
    se01 = row[4]
    se02 = row[5]
    se03 = row[6]
    pp += total
    if pp % 100000 == 0:
        print "Processed %d points" % pp
    for i in range(se01):
        wpoint = randomPoint(workGeom)
        hpoint = randomPoint(homeGeom)
        data += LonLatToPixelXY(wpoint)
        data += LonLatToPixelXY(hpoint)
        data.append(distance)
        data.append(total)
        data.append(1.)
        data.append(0.)
        data.append(0.)

    for i in range(se02):
        wpoint = randomPoint(workGeom)
        hpoint = randomPoint(homeGeom)
        data += LonLatToPixelXY(wpoint)
        data += LonLatToPixelXY(hpoint)
        data.append(distance)
        data.append(total)
        data.append(0.)
        data.append(1.)
        data.append(0.)

    for i in range(se03):
        wpoint = randomPoint(workGeom)
        hpoint = randomPoint(homeGeom)
        data += LonLatToPixelXY(wpoint)
        data += LonLatToPixelXY(hpoint)
        data.append(distance)
        data.append(total)
        data.append(0.)
        data.append(0.)
        data.append(1.)

print "%d total points" % (len(data) / 9)
dest = 'pa_od_main_jt00_2011-all-points.bin'
array.array('f', data).tofile(open(dest, 'w'))
