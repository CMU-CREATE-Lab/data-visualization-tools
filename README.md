Example invocation (URL):

    http://localhost/viirs/?source=bin/viirs-flaring-2013-12-10.bin

where bin/viirs-flaring-2013-12-10.bin is an (in this case relative) URL to the binary file to visualize.

Being a description of the contents of the directory viirs/ contaimned within some older eldritch directory pertaining to the documentation and expose of the ritual and repeated penetration of the earth's crust with the intent of extracting voltaile and noxious gasses and fluids that were heretofor contained within by entities whose motives are best understood to be govenered and driven by greed and worship of the cult of mithras


    Directory Organization
    bin/
      Binary formated files. Probably output from scripts in ruby/.
    csv/
      CSV formatted files containing VIIRS data from the Suomi NPP satellite.
    json/
      JSON formatted files. Probably output from script in ruby/.
    ruby/
      Scripts for doing stuff with stuff.


Sample pipeline
Take a CSV file, produce a JSON file.

    $ cd drilling-data-tools/visualize/viirs
    $ ./ruby/csv-to-json.rb -f csv/viirs-csv-2013-08-05-to-2013-09-03.csv 
    $ mv viirs-csv-2013-08-05-to-2013-09-03.json json/

Take a JSON FILE, create a binary file.

* latitidue float
* longitude float 
* date int
* radiantoutput float 
* temperature int
* radiativeheat float 
* footprint float

All data must be little endian

    ["31.459555".to_f].pack("e")
    [DateTime.strptime("2013-08-28 00:05:01+00:00", '%Y-%m-%d %H:%M:%S%z').to_time.to_i].pack("l<")


# Tools and data

Tools for converting between csv, json and geojson are available in the [swissarmykitchensink](https://github.com/redhog/swissarmykitchensink/blob/master/README.md) pip package.

Example data is available in the data branch of this repo. NOTE: Do not merge between the data branch and the master branch - they are entierly separate.
