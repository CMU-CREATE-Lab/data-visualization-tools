#! /bin/bash

BUCKET=viirs.skytruth.org
NAME=viirs-0.5NM-30days-3dtc
RADIUS=0.008333333333333333
TIMEWINDOW="30 days"
DETECTIONS=3

scripts/viirs_db_to_csv.sh "$RADIUS" "$TIMEWINDOW" "$DETECTIONS" > data/csv/$NAME.csv

skyconvert data/csv/$NAME.csv data/json/$NAME.json
gzip -f data/csv/$NAME.csv
scripts/json-to-bin.py data/json/$NAME.json data/bin/$NAME.bin
gsutil -m cp -z bin -a public-read -r data/bin/$NAME.bin gs://$BUCKET/viirs/data/bin
gsutil -m cp -a public-read -r data/csv/$NAME.csv.gz gs://$BUCKET/viirs/data/csv
