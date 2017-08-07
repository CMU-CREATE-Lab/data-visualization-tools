#!/bin/sh
uwsgi --ini tileserve-staging.ini --mount /=tileserve_staging:app --processes=10

