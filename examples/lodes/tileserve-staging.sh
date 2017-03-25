#!/bin/sh
uwsgi --ini tileserve-staging.ini --mount /=tileserve:app --processes=10

