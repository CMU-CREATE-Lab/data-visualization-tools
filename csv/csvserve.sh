#!/bin/sh
uwsgi --ini csvserve.ini --mount /=csvserve:app --processes=3
