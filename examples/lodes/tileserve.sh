#!/bin/sh
uwsgi --ini tileserve.ini --mount /=tileserve:app --processes=10

