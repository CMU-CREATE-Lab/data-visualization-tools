Suggested data directory organization

    bin/
      Binary formated files as output by json-to-bin.py
    csv/
      CSV formatted files containing source data
    json/
      Source data converted to JSON using e.g. skyconvert


Sample pipeline to take a CSV file and produce a BIN file.

    $ cd drilling-data-tools
    $ skyconvert csv/viirs-csv-2013-08-05-to-2013-09-03.csv json/viirs-csv-2013-08-05-to-2013-09-03.json 
    $ ./scripts/json-to-bin.py json/viirs-csv-2013-08-05-to-2013-09-03.json bin/viirs-csv-2013-08-05-to-2013-09-03.bin

For required columns check the documentation for the specific app and animations you will be using.

# Tools

Tools for converting between csv, json and geojson are available in the [swissarmykitchensink](https://github.com/redhog/swissarmykitchensink/blob/master/README.md) pip package.
