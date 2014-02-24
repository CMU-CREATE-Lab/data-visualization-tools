create view ais_fishing_days as
  select
    extract (epoch from day) as datetime,
    mmsi,
    latitude,
    longitude,
    round(score * 256) as red,
    round((1 - score) * 256) as green,
    0 as blue,
    score * 256 as magnitude
  from
    (select
       day.day,
       ais.mmsi,
       avg(ais.latitude) as latitude,
       avg(ais.longitude) as longitude,
       least(1, (coalesce(stddev(sog), 0) / 30 + coalesce(stddev(cog), 0) / 360) * 2) as score
     from
       generate_series((select min(datetime) from appomatic_mapdata_ais), (select max(datetime) from appomatic_mapdata_ais), interval '3 hours') as day
       join appomatic_mapdata_ais as ais on
         ais.sog <= 30
         and ais.latitude > -36.39
         and ais.latitude < -16.56
         and ais.longitude > -121.48
         and ais.longitude < -94.24
         and abs(ais.latitude - -27.125996) > 0.1
         and abs(ais.longitude - -109.358501) > 0.1
         and ais.datetime > day.day - '6 hours'::interval
         and ais.datetime < day.day
     group by day.day, ais.mmsi) as a;
