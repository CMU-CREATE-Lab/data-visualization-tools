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
       sqrt(count(*)) / 45 as magnitude,
       least(1, 2 * (avg(1 - sog/30) + stddev(sog / 30) + stddev(cog / 360)) / 3) as score
     from
       generate_series((select min(datetime) from appomatic_mapdata_ais), (select max(datetime) from appomatic_mapdata_ais), interval '1 day') as day
       join appomatic_mapdata_ais as ais on
         ais.sog <= 30
         and ais.latitude > -36.39
         and ais.latitude < -16.56
         and ais.longitude > -121.48
         and ais.longitude < -94.24
         and abs(ais.latitude - -27.125996) > 0.1
         and abs(ais.longitude - -109.358501) > 0.1
         and ais.datetime > day.day
         and ais.datetime < day + '1 days'
     group by day.day, ais.mmsi) as a;
