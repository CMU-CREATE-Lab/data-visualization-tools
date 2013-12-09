Being a description of the contents of the directory viirs/ contaimned within some older eldritch directory pertaining to the documentation and expose of the ritual and repeated penetration of the earth's crust with the intent of extracting voltaile and noxious gasses and fluids that were heretofor contained within by entities whose motives are best understood to be govenered and driven by greed and worship of the cult of mithras


# Directory Organization

* bin/ Binary formated files. Probably output from scripts in ruby/.
* csv/ CSV formatted files containing VIIRS data from the Suomi NPP satellite.
* json/ JSON formatted files. Probably output from script in ruby/.
* ruby/ Scripts for doing stuff with stuff.


# Sample pipeline
Take a CSV file, produce a JSON file and then convert into binary format:

    $ cd drilling-data-tools/visualize/viirs
    $ ./ruby/csv-to-json.rb -f csv/viirs-csv-2013-08-05-to-2013-09-03.csv 
    $ mv viirs-csv-2013-08-05-to-2013-09-03.json json/
    $ cd bin
    $ ../ruby/json-to-bin.rb --file=../json/viirs-csv-2013-08-05-to-2013-09-03.json

Note that this binary format is valid for 0{1-4}.html, but not for 0{5,6}.html...

Take a JSON FILE, create a binary file.

    latitidue float
    longitude float 
    date int
    radiantoutput float 
    temperature int
    radiativeheat float 
    footprint float

    // little endian
    ["31.459555".to_f].pack("e")
    [DateTime.strptime("2013-08-28 00:05:01+00:00", '%Y-%m-%d %H:%M:%S%z').to_time.to_i].pack("l<")

