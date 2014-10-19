#!/bin/sh

ssh tm1 mkdir -p web/webgl-timemachine/1068x600
rsync -av 1068x600/ tm1:web/webgl-timemachine/1068x600
