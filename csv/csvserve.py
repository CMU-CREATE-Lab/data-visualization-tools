#!/usr/bin/env python

import sys
print sys.executable

from urllib2 import parse_http_list as _parse_list_header

import ast, flask, json, numpy, os, struct, tempfile, time, random, re, sys
from flask import after_this_request, request
from cStringIO import StringIO as IO
import gzip
import functools

def exec_ipynb(filename_or_url):
    nb = (urllib2.urlopen(filename_or_url) if re.match(r'https?:', filename_or_url) else open(filename_or_url)).read()
    jsonNb = json.loads(nb)
    #check for the modified formatting of Jupyter Notebook v4
    if(jsonNb['nbformat'] == 4):
        exec '\n'.join([''.join(cell['source']) for cell in jsonNb['cells'] if cell['cell_type'] == 'code']) in globals()
    else:
        exec '\n'.join([''.join(cell['input']) for cell in jsonNb['worksheets'][0]['cells'] if cell['cell_type'] == 'code']) in globals()

exec_ipynb('placenames-server.ipynb')

app = flask.Flask(__name__)

@app.route('/')
def hello():
    html = '<html><head></head><body>'
    html += 'CSV server says hello'
    html += '</body></html>'
    return flask.Response(html, mimetype='text/html')

@app.route('/<path:ignore>')
def translate_csv_handler(ignore):
    html = '<html><head></head><body>'
    parsed = urlparse.urlparse(request.url)
    remote_url = 'https:/' + parsed.path
    if parsed.query:
        remote_url += '?' + parsed.query
    html += translate_csv(remote_url)
    html += '</body></html>'
    response = flask.Response(html, mimetype='text/html')
    response.headers['Access-Control-Allow-Origin'] = '*'
    return response    
