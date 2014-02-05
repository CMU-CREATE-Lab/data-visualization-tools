#! /bin/bash

BINDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DATADIR="$BINDIR/../data"

source "$BINDIR/config.sh"

mkdir -p "$DATADIR/"{csv,json,geojson,kml,bin}

"$BINDIR/viirs_db_to_csv.sh" "$RADIUS" "$TIMEWINDOW" "$DETECTIONS" > "$DATADIR/csv/$NAME.csv"
cluster --eps="$RADIUS" --min_samples="$DETECTIONS" "$DATADIR/csv/$NAME.csv" "$DATADIR/csv/$NAME.clusters.csv" 

skyconvert "$DATADIR/csv/$NAME.csv" "$DATADIR/json/$NAME.json"
skyconvert "$DATADIR/csv/$NAME.clusters.csv" "$DATADIR/geojson/$NAME.clusters.geojson"
ogr2ogr -f KML "$DATADIR/kml/$NAME.clusters.kml" "$DATADIR/geojson/$NAME.clusters.geojson"

gzip -f "$DATADIR/csv/$NAME.csv"
"$BINDIR/json-to-bin.py" "$DATADIR/json/$NAME.json" "$DATADIR/bin/$NAME.bin"
gsutil -m cp -z bin -a public-read -r "$DATADIR/bin/$NAME.bin" gs://$BUCKET/viirs/data/bin
gsutil -m cp -a public-read -r "$DATADIR/csv/$NAME.csv.gz" gs://$BUCKET/viirs/data/csv
gsutil -m cp -a public-read -r "$DATADIR/kml/$NAME.clusters.kml" gs://$BUCKET/viirs/data/kml
