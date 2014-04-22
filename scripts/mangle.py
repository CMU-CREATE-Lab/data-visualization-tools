import csv
import sys

series = -1
lastMmsi = None
icols = ['mmsi', 'longitude', 'latitude', 'timestamp', 'magnitude']
ocols = ['mmsi', 'longitude', 'latitude', 'datetime', 'magnitude', 'series', 'red', 'green', 'blue']
with open(sys.argv[2], "w") as of:
    w = csv.DictWriter(of, ocols)
    w.writeheader()
    with open(sys.argv[1]) as f:
        r = csv.reader(f)
        for row in r:
            row = dict(zip(icols, row))
            magnitude = float(row['magnitude'])
            if magnitude <= 0.5:
                row['magnitude'] = '0'
                row['red'] = '255'
                row['green'] = '0'
                row['blue'] = '255'
            else:
                row['magnitude'] = str(min(255, int(128 + (magnitude-0.5) * (256-128.0) / 2.0)))
                row['red'] = str(min(255, int((magnitude-0.5) * 256 / 2.0)))
                row['green'] = str(255 - int(row['red']))
                row['blue'] = '0'
            if row['mmsi'] != lastMmsi:
                lastMmsi = row['mmsi']
                series += 1
            row['series'] = str(series)
            row['datetime'] = row.pop('timestamp')            
            w.writerow(row)
