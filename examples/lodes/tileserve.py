#!/usr/bin/env python

import flask, numpy, os, psycopg2, struct, tempfile, time, random, sys

app = flask.Flask(__name__)

#############

from flask import after_this_request, request
from cStringIO import StringIO as IO
import gzip
import functools

def gzipped(f):
    @functools.wraps(f)
    def view_func(*args, **kwargs):
        @after_this_request
        def zipper(response):
            accept_encoding = request.headers.get('Accept-Encoding', '')
            
            if 'gzip' not in accept_encoding.lower():
                return response
            
            response.direct_passthrough = False
            
            if (response.status_code < 200 or
                response.status_code >= 300 or
                'Content-Encoding' in response.headers):
                return response
            gzip_buffer = IO()
            gzip_file = gzip.GzipFile(mode='wb',
                                      fileobj=gzip_buffer)
            gzip_file.write(response.data)
            gzip_file.close()
            
            response.data = gzip_buffer.getvalue()
            response.headers['Content-Encoding'] = 'gzip'
            response.headers['Vary'] = 'Accept-Encoding'
            response.headers['Content-Length'] = len(response.data)
            
            return response
        
        return f(*args, **kwargs)
    
    return view_func

def pack_color(color):
    return color['r'] + color['g'] * 256.0 + color['b'] * 256.0 * 256.0;

def unpack_color(f):
    b = floor(f / 256.0 / 256.0)
    g = floor((f - b * 256.0 * 256.0) / 256.0)
    r = floor(f - b * 256.0 * 256.0 - g * 256.0)
    return {'r':r,'g':g,'b':b}

prototile_record_format = '<ffii'  # x, y, block id, seq within block
prototile_record_len = struct.calcsize(prototile_record_format)

tile_record_format = '<fff'  # x, y, color
tile_record_len = struct.calcsize(tile_record_format)

default_psql_database = 'census2010'

def query_psql(query, quiet=False, database=None):
    database = database or default_psql_database
    conn = psycopg2.connect(dbname=database, host='/var/run/postgresql')
    before = time.time()
    cur = conn.cursor()
    cur.execute(query)
    rows = cur.fetchall()
    cur.close()
    elapsed = time.time() - before
    if not quiet:
        sys.stdout.write('Execution of %s\ntook %g seconds and returned %d rows\n' % (query.strip(), elapsed, len(rows)))
    return rows

def load_column(dataset, column):
    cache_dir = 'columncache'
    cache_filename = '{cache_dir}/{dataset}/{column}.numpy'.format(**locals())
    data = numpy.load(open(cache_filename))
    print 'Read {cache_filename}'.format(**locals())
    return data

p2000 = load_column('census2000_block2010', 'p001001')
p2010 = load_column('census2010_block2010', 'p001001')

#p2010 = numpy.array([0] + [x[0] for x in query_psql("""
#SELECT p001001
#FROM sf1_2010_block_p001
#ORDER BY blockidx2010
#""")])

cols = [numpy.minimum(p2000, p2010),
        numpy.maximum(0, p2000-p2010),
        numpy.maximum(0, p2010-p2000)]

red_color = pack_color({'r':255, 'g':0, 'b':0})

colors = [pack_color({'r':0, 'g':0, 'b':255}),   # blue:  both 2000 and 2010
          pack_color({'r':255, 'g':0, 'b':0}),   # red: disappeared
          pack_color({'r':0, 'g':255, 'b':0})]   # green: added

#cols = [numpy.subtract(numpy.multiply(p2000, 1.0), 0.0)]

#@app.after_request
#def after_request(response):
#    print "got an after request"
#    print 'Content-Length was ', response.headers['Content-Length']
#    response.headers['Content-Length']=None
#    #response.headers.remove('Content-Length')
#    response.headers['Content-Encoding'] = 'gzip'
#    return response

@app.route('/<z>/<x>/<y>.<suffix>')
@gzipped
def hello_world(z, x, y, suffix):
    start_time = time.time()
    prototile_path = '/home/rsargent/projects/unemployed-dotmap/data-visualization-tools/examples/lodes/prototiles/{z}/{x}/{y}.bin'.format(**locals())
    prototile = open(prototile_path).read()
    duration = int(1000 * (time.time() - start_time))
    print '{z}/{x}/{y}: {duration}ms to read prototile'.format(**locals())
    
    start_time = time.time()
    npoints = len(prototile) / prototile_record_len
    # remove block # and seq #, add color
    tile = bytearray(npoints * tile_record_len)
    outcount = 0
    for i in range(0, npoints):
        (x, y, blockidx, seq) = struct.unpack_from(prototile_record_format, prototile, i * prototile_record_len)
        # TODO:
        # Decide if we want to keep the randomness
        # If so, make this deterministic and fast
        seq += random.random()

        for c in range(len(cols)):
            seq -= cols[c][blockidx]
            if seq < 0:
                struct.pack_into(tile_record_format, tile,
                                 outcount * tile_record_len,
                                 x, y, colors[c])
                outcount += 1
                break

    duration = int(1000 * (time.time() - start_time))
    print '{z}/{x}/{y}: {duration}ms to create tile from prototile'.format(**locals())

    if suffix == 'debug':
        html = '<html><head></head><body>'
        html += 'tile {prototile_path} has {outcount} points<br>'.format(**locals())
        for i in range(0, min(outcount, 10)):
            html += 'Point {i}: '.format(**locals())
            html += ', '.join([str(x) for x in struct.unpack_from(tile_record_format, tile, i * tile_record_len)])
            html += '<br>\n'
        if npoints > 10:
            html += '...<br>'
        html += '</body></html>'
        
        return flask.Response(html, mimetype='text/html')
    elif suffix == 'bin':
        response = flask.Response(tile[0 : outcount * tile_record_len], mimetype='application/octet-stream')
        response.headers['Access-Control-Allow-Origin'] = '*'
        return response
    else:
        raise 'Invalid suffix {suffix}'.format(**locals())

#app.run(host='0.0.0.0', port=5000)
print 'hello'

