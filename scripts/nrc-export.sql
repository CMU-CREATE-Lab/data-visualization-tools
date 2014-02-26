select extract(epoch from incident_datetime) as datetime, lat as latitude, lng as longitude from feedentry where 'NRC' = any(tags) order by incident_datetime;
