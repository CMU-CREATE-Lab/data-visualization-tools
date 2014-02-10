wells
=====
WebGL visualizations of the growth and spread of drilling wells. google-maps.html displays the point data

Generate the bin data
---------------------
./scripts/json-to-bin.rb -f json/wells-2013-10-02.json  --latKey Lat --lngKey Lon --dateKey Date

Generate the date-index
------------------------
./scripts/date-indexer.rb -f bin/wells-2013-10-02_date.bin -s 31536000

TODOs
-----
Clean wells-2013-10-02.json of bad dates.



