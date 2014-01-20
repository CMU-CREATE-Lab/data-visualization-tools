#! /bin/bash

# This query does not work!!!
# select (t2.y).* from (select 1 as x, (select t from (values (1, 2, 3)) t (a, b, c)) as y) as t2;

radius="$1"      # "0.0134989"
timewindow="$2"  # "30 days"
clustersize="$3" # "1"

run() {
  db_export.py conn=psycopg2 host=localhost user=test database=test password=test expr="$1"
}
ex() {
  run "$1" > /dev/null
}

ex 'drop table viirs_tmp1 cascade' > /dev/null 2>&1
ex 'drop table viirs_tmp2 cascade' > /dev/null 2>&1
ex 'create table viirs_tmp1 as select * from appomatic_mapdata_viirs where src = '\''VIIRS_CORRECTED'\'' and "Temperature" > 1773 and "Temperature" != 1810 and latitude > -65'
ex 'create index "viirs_tmp1_RadiantOutput" ON viirs_tmp1 USING btree ("RadiantOutput")'
ex 'create index "viirs_tmp1_RadiativeHeat" ON viirs_tmp1 USING btree ("RadiativeHeat")'
ex 'create index "viirs_tmp1_SourceID_like" ON viirs_tmp1 USING btree ("SourceID" varchar_pattern_ops)'
ex 'create index "viirs_tmp1_Temperature" ON viirs_tmp1 USING btree ("Temperature")'
ex 'create index viirs_tmp1_footprint ON viirs_tmp1 USING btree (footprint)'
ex 'create index viirs_tmp1_latitude ON viirs_tmp1 USING btree (latitude)'
ex 'create index viirs_tmp1_location ON viirs_tmp1 USING btree (location)'
ex 'create index viirs_tmp1_location_id ON viirs_tmp1 USING gist (location)'
ex 'create index viirs_tmp1_longitude ON viirs_tmp1 USING btree (longitude)'
ex 'create index viirs_tmp1_quality ON viirs_tmp1 USING btree (quality)'
ex 'create index viirs_tmp1_src ON viirs_tmp1 USING btree (src)'
ex 'create index viirs_tmp1_src_like ON viirs_tmp1 USING btree (src varchar_pattern_ops)'
ex 'create index "viirs_tmp1_all" on viirs_tmp1 (latitude, longitude, datetime)'
ex '
  create table viirs_tmp2 as select
    v.*,
    (select
       ST_Collect(v2.location)
     from
       viirs_tmp1 as v2
     where 
       v2.latitude < v.latitude + '"$radius"'
       and v2.latitude > v.latitude - '"$radius"'
       and v2.longitude < v.longitude + '"$radius"'
       and v2.longitude > v.longitude - '"$radius"'
       and v2.datetime > v.datetime - '\'"$timewindow"\''::interval
       and v2.datetime < v.datetime
    ) as cluster
  from
    viirs_tmp1 as v;
'

run '
  select
    s.id,
    s.src,
    s.datetime,
    s.name,
    s."RadiantOutput",
    s."Temperature" - 273.15 as "Temperature",
    s."RadiativeHeat",
    s."footprint",
    s."SatZenithAngle",
    s."SourceID",
    s.region,
    s.srcfile,
    s.quality,
    st_x(st_centroid(s.cluster)) as longitude,
    st_y(st_centroid(s.cluster)) as latitude
  from
    viirs_tmp2 as s
  where
    ST_NumGeometries(s.cluster) >= '$clustersize'
  order by
    s."datetime" asc;
'
ex 'drop table viirs_tmp1 cascade'
ex 'drop table viirs_tmp2 cascade'
