/home/rsargent/anaconda/bin/uwsgi --ini /t/csv.createlab.org/data-visualization-tools/csv/csvserve.ini --mount /=csvserve:app --processes 2 --threads 4 --master
