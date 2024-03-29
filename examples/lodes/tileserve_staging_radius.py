#!/usr/bin/env python

import sys, traceback

from urllib2 import parse_http_list as _parse_list_header

import ast, flask, functools, gzip, json, numpy, os, psycopg2, random, re, struct, sys, tempfile, time, urlparse
from flask import after_this_request, request
from cStringIO import StringIO as IO

os.chdir(os.path.dirname(os.path.abspath(__file__)))

def exec_ipynb(filename_or_url):
    nb = (urllib2.urlopen(filename_or_url) if re.match(r'https?:', filename_or_url) else open(filename_or_url)).read()
    jsonNb = json.loads(nb)
    #check for the modified formatting of Jupyter Notebook v4
    if(jsonNb['nbformat'] == 4):
        exec '\n'.join([''.join(cell['source']) for cell in jsonNb['cells'] if cell['cell_type'] == 'code']) in globals()
    else:
        exec '\n'.join([''.join(cell['input']) for cell in jsonNb['worksheets'][0]['cells'] if cell['cell_type'] == 'code']) in globals()

exec_ipynb('timelapse-utilities.ipynb')

set_default_psql_database('census2010')


app = flask.Flask(__name__)

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
            nbytes = len(response.data)
            start_time = time.time()
            gzip_buffer = IO()
            gzip_file = gzip.GzipFile(mode='wb',
                                      fileobj=gzip_buffer,
                                      compresslevel=1)
            gzip_file.write(response.data)
            gzip_file.close()
            
            response.data = gzip_buffer.getvalue()
            duration = int(1000 * (time.time() - start_time))
            print '{duration}ms to gzip {nbytes} bytes'.format(**locals())

            response.headers['Content-Encoding'] = 'gzip'
            response.headers['Vary'] = 'Accept-Encoding'
            response.headers['Content-Length'] = len(response.data)
            
            return response
        
        return f(*args, **kwargs)
    
    return view_func

def pack_color(color):
    return color['r'] + color['g'] * 256.0 + color['b'] * 256.0 * 256.0;

# packs to the range 0 ... 256^3-1
def unpack_color(f):
    b = floor(f / 256.0 / 256.0)
    g = floor((f - b * 256.0 * 256.0) / 256.0)
    r = floor(f - b * 256.0 * 256.0 - g * 256.0)
    return {'r':r,'g':g,'b':b}

def pack_color(color):
    return color['r'] + color['g'] * 256.0 + color['b'] * 256.0 * 256.0;

def parse_color(color):
    color = color.strip()
    c = color
    try:
        if c[0] == '#':
            c = c[1:]
        if len(c) == 3:
            return pack_color({'r': 17 * int(c[0:1], 16),
                               'g': 17 * int(c[1:2], 16),
                               'b': 17 * int(c[2:3], 16)})
        if len(c) == 6:
            return pack_color({'r': int(c[0:2], 16),
                               'g': int(c[2:4], 16),
                               'b': int(c[4:6], 16)})
    except:
        pass
    raise InvalidUsage('Cannot parse color <code><b>%s</b></code> from spreadsheet.<br><br>Color must be in standard web form, <code><b>#RRGGBB</b></code>, where RR, GG, and BB are each two-digit hexadecimal numbers between 00 and FF.<br><br>See <a href="https://www.w3schools.com/colors/colors_picker.asp">HTML Color Picker</a>' % color)

def parse_colors(colors):
    packed = [parse_color(color) for color in colors]
    return numpy.array(packed, dtype = numpy.float32)

color3dark1 = parse_colors(['#1b9e77','#d95f02','#7570b3'])
color3dark2 = parse_colors(['#66c2a5','#fc8d62','#8da0cb'])

color4dark1 = parse_colors(['#1b9e77','#d95f02','#7570b3','#e7298a'])
color4dark2 = parse_colors(['#b3e2cd','#fdcdac','#cbd5e8','#f4cae4'])
color4dark3 = parse_colors(['#e41a1c','#377eb8','#4daf4a','#984ea3'])
color4dark4 = parse_colors(['#66c2a5','#fc8d62','#8da0cb','#e78ac3'])
color4dark5 = parse_colors(['#e41a1c','#4daf4a','#984ea3','#ff7f00'])

color5dark1 = parse_colors(['#a6cee3','#1f78b4','#b2df8a','#33a02c','#fb9a99'])
color5dark2 = parse_colors(['#e41a1c','#377eb8','#4daf4a','#984ea3','#ff7f00'])
color5dark3 = parse_colors(['#66c2a5','#fc8d62','#8da0cb','#e78ac3','#a6d854'])

color3light1 = parse_colors(['#7fc97f','#beaed4','#fdc086'])
color3light2 = parse_colors(['#1b9e77','#d95f02','#7570b3'])
color3light3 = parse_colors(['#66c2a5','#fc8d62','#8da0cb'])

color4light1 = parse_colors(['#1b9e77','#d95f02','#7570b3','#e7298a'])
color4light2 = parse_colors(['#b3e2cd','#fdcdac','#cbd5e8','#f4cae4'])
color4light3 = parse_colors(['#e41a1c','#377eb8','#4daf4a','#984ea3'])

color5light1 = parse_colors(['#1b9e77','#d95f02','#7570b3','#e7298a','#66a61e'])
color5light2 = parse_colors(['#e41a1c','#377eb8','#4daf4a','#984ea3','#ff7f00'])
color5light3 = parse_colors(['#66c2a5','#fc8d62','#8da0cb','#e78ac3','#a6d854'])

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

column_cache = {}

class InvalidUsage(Exception):
    def __init__(self, message):
        self.message = message

cache_dir = 'columncache'

def list_datasets():
    return sorted(os.listdir(cache_dir))

# Compute relative path from request to /data
def dataroot():
    return '../' * len(request.path.split('/')) + 'data'

def list_columns(dataset):
    dir = '{cache_dir}/{dataset}'.format(cache_dir=cache_dir, **locals())
    if not os.path.exists(dir):
        msg = 'Dataset named "{dataset}" not found.<br><br><a href="{dataroot}">List valid datasets</a>'.format(dataroot=dataroot(), **locals())
        raise InvalidUsage(msg)
    return sorted([c.replace('.numpy', '') for c in os.listdir(dir)])

def load_column(dataset, column):
    cache_key = '{dataset}.{column}'.format(**locals())
    if cache_key in column_cache:
        return column_cache[cache_key]
    dir = '{cache_dir}/{dataset}'.format(cache_dir=cache_dir, **locals())
    if not os.path.exists(dir):
        msg = 'Dataset named "{dataset}" not found.<br><br><a href="{dataroot}">List valid datasets</a>'.format(dataroot=dataroot(), **locals())
        raise InvalidUsage(msg)
    cache_filename = '{dir}/{column}.numpy'.format(**locals())
    try:
        data = numpy.load(open(cache_filename))
    except:
        msg = 'Column named "{column}" in dataset "{dataset}" not found.<br><br><a href="{dataroot}/{dataset}">List valid columns from {dataset}</a>'.format(dataroot=dataroot(), **locals())
        raise InvalidUsage(msg)
        
    print 'Read {cache_filename}'.format(**locals())
    column_cache[cache_key] = data
    return data

binary_operators = {
    ast.Add:  numpy.add,
    ast.Sub:  numpy.subtract,
    ast.Mult: numpy.multiply,
    ast.Div:  numpy.divide,
}

unary_operators = {
    ast.USub: numpy.negative, # negation (unary subtraction)
}

functions = {
    'max': numpy.maximum,
    'min': numpy.minimum,
}

def eval_(node):
    if isinstance(node, ast.Num): # <number>
        return node.n
    elif isinstance(node, ast.BinOp): # <left> <operator> <right>
        return binary_operators[type(node.op)](eval_(node.left), eval_(node.right))
    elif isinstance(node, ast.UnaryOp): # <operator> <operand> e.g., -1
        return unary_operators[type(node.op)](eval_(node.operand))
    elif isinstance(node, ast.Call):
        func_name = node.func.id
        if not func_name in functions:
            raise InvalidUsage('Function {func_name} does not exist.  Valid functions are '.format(**locals()) +
                               ', '.join(sorted(functions.keys())))
        return apply(functions[func_name], [eval_(arg) for arg in node.args])
    elif isinstance(node, ast.Attribute):
        return load_column(node.value.id, node.attr)
    raise InvalidUsage('cannot parse %s' % ast.dump(node))

    
def eval_layer_column(expr):
    try:
        return eval_(ast.parse(expr, mode='eval').body)
    except SyntaxError,e:
        raise InvalidUsage('<pre>' + traceback.format_exc(0) + '</pre>')

def assemble_cols(cols):
    return numpy.hstack([c.reshape(len(c), 1) for c in cols]).astype(numpy.float32)

populations = {}
colors = {}

def compute_tile_data_python(prototile_path, incount, tile, populations):
    raise 'Dont call me'
    prototile = open(prototile_path).read()
    assert(incount == len(prototile) / prototile_record_len)
    
    outcount = 0
    for i in range(incount):
        (x, y, blockidx, seq) = struct.unpack_from(prototile_record_format,
                                                   prototile,
                                                   i * prototile_record_len)
        # TODO:
        # Decide if we want to keep the randomness.
        # If so, make this deterministic and fast.
        seq += random.random()
        #seq += 0.5

        for c in range(populations.shape[1]):
            seq -= populations[blockidx, c]
            if seq < 0:
                struct.pack_into(tile_record_format, tile,
                                 outcount * tile_record_len,
                                 x, y, colors[c])
                outcount += 1
                break
    return outcount

compute_tile_data_ext = compile_and_load("""
#include <math.h>
#include <stdint.h>
#include <stdlib.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/mman.h>
#include <stdio.h>

typedef struct {
  float x;
  float y;
  uint32_t blockIdx;
  uint32_t seq;
} __attribute__ ((packed)) PrototileRecord;

typedef struct {
  float x;
  float y;
  float color;
} __attribute__ ((packed)) TileRecord;

// Input is range 0 ... 1 inclusive
float pack4_c(const float v[4]) {
  float tmp[4];
  // Keep only top 7 bits of each component
  for (unsigned i = 0; i < 4; i++) tmp[i] = floor(127.0 * v[i] + 0.5);
  // Encode x,y,z in the mantissa, by creating a number 1.0 <= x < 2.0
  float f = 1.0 + tmp[0]/128.0 + tmp[1]/(128.0*128.0) + tmp[2]/(128.0*128.0*128.0);
  // Encode w in the exponent, and combine by multiplying
  return exp2(tmp[3]) * f;
}

// For some reason, radius <= 126.0/127.0 we think
float reencode_color_with_radius(float color, float radius) {
  float v[4];
  v[3] = radius;
  // Decode old color encoding which is 0 ... 256^3-1 maps to 0..1 , 0..1, 0..1
  v[2] = floor(color / 256.0 / 256.0);
  v[1] = floor((color - v[2] * 256.0 * 256.0) / 256.0);
  v[0] = floor(color - v[2] * 256.0 * 256.0 - v[1] * 256.0);

  v[0] /= 255.0;
  v[1] /= 255.0;
  v[2] /= 255.0;

  return pack4_c(v);
}

int compute_tile_data(
    const char *prototile_path,
    int incount,
    TileRecord *tile_data,
    int tile_data_length,
    float *populations,
    unsigned int pop_rows,
    unsigned int pop_cols,
    float *colors)
{
    if (incount == 0) return 0;
    if (incount * sizeof(TileRecord) != tile_data_length) {
        return -10;
    }

    int fd = open(prototile_path, O_RDONLY);
    if (fd < 0) return -1;

    PrototileRecord *p = mmap (0, incount*sizeof(PrototileRecord),
                               PROT_READ, MAP_SHARED, fd, 0);
    if (p == MAP_FAILED) return -2;
    double sum = 0;
    for (unsigned i = 0 ; i < pop_rows * pop_cols; i++) {
        sum += populations[i];
    }

    unsigned outcount = 0;
    // Loop over all the records in a prototile
    for (unsigned i = 0; i < incount; i++) {
        PrototileRecord rec = p[i];
        double seq = rec.seq;
        seq += (double)rand() / (double)((unsigned)RAND_MAX + 1);
        seq += 0.5;

        // Compute total population we're trying to show
        double total_pop = 0.0;
        for (unsigned c = 0; c < pop_cols; c++) {
            total_pop += populations[rec.blockIdx * pop_cols + c];
        }

        for (unsigned c = 0; c < pop_cols; c++) {
            if (rec.blockIdx * pop_cols + c >= pop_rows * pop_cols) {
                fprintf(stdout, 
                        "Error: rec.blockIdx is %d, pop_rows is %d\\n",
                        rec.blockIdx, pop_rows);
                return -3;
            }
            seq -= populations[rec.blockIdx * pop_cols + c];
            if (seq < 0) {
                if (outcount >= incount) return -4;
                tile_data[outcount].x = rec.x;
                tile_data[outcount].y = rec.y;
                float radius = 5.0;
                tile_data[outcount].color = reencode_color_with_radius(colors[c], radius / 10.0);
                outcount++;
                break;
            }
        }
    }
    munmap(p, incount*sizeof(PrototileRecord));
    close(fd);
    return outcount;
}
""")

def compute_tile_data_c(prototile_path, incount, tile, populations, colors):
    assert(populations.dtype == numpy.float32)
    assert(colors.dtype == numpy.float32)
    return compute_tile_data_ext.compute_tile_data(
        prototile_path,
        int(incount),
        to_ctype_reference(tile),
        len(tile),
        to_ctype_reference(populations),
        populations.shape[0], populations.shape[1],
        to_ctype_reference(colors))

def generate_tile_data(layer, z, x, y, use_c=False):
    start_time = time.time()
    # remove block # and seq #, add color
    
    prototile_path = 'prototiles/{z}/{x}/{y}.bin'.format(**locals())
    incount = os.path.getsize(prototile_path) / prototile_record_len
    tile = bytearray(tile_record_len * incount)
    if use_c:
        ctd = compute_tile_data_c
    else:
        ctd = compute_tile_data_python
        
    outcount = ctd(prototile_path, incount, tile, layer['populations'], layer['colors'])
    if outcount < 0:
        raise Exception('compute_tile_data returned error %d' % outcount)

    duration = int(1000 * (time.time() - start_time))
    print '{z}/{x}/{y}: {duration}ms to create tile from prototile'.format(**locals())

    return tile[0 : outcount * tile_record_len]


layer_cache = {}

def find_or_generate_layer(layerdef):
    if layerdef in layer_cache:
        print 'Using cached {layerdef}'.format(**locals())
        return layer_cache[layerdef]

    print 'Computing {layerdef}'.format(**locals())
    colors = []
    populations = []
    for (color, expression) in [x.split(';') for x in layerdef.split(';;')]:
        colors.append(color)
        populations.append(eval_layer_column(expression))

    layer = {'populations':assemble_cols(populations),
             'colors':parse_colors(colors)}
    layer_cache[layerdef] = layer
    return layer

@app.route('/tilesv1/<layerdef>/<z>/<x>/<y>.<suffix>')
@gzipped
def serve_tile_v1(layerdef, z, x, y, suffix):
    try:
        layer = find_or_generate_layer(layerdef)
        tile = generate_tile_data(layer, z, x, y, use_c=True)
        outcount = len(tile) / tile_record_len
        
        if suffix == 'debug':
            html = '<html><head></head><body>'
            html += 'tile {layer}/{z}/{y}/{x}  has {outcount} points<br>'.format(**locals())
            for i in range(0, min(outcount, 10)):
                html += 'Point {i}: '.format(**locals())
                html += ', '.join([str(x) for x in struct.unpack_from(tile_record_format, tile, i * tile_record_len)])
                html += '<br>\n'
            if outcount > 10:
                html += '...<br>'
                html += '</body></html>'
                    
            return flask.Response(html, mimetype='text/html')
        elif suffix == 'bin':
            response = flask.Response(tile[0 : outcount * tile_record_len], mimetype='application/octet-stream')
        else:
            raise InvalidUsage('Invalid suffix {suffix}'.format(**locals()))
    except InvalidUsage, e:
        response = flask.Response('<h2>400 Invalid Usage</h2>' + e.message, status=400)
    except:
        print traceback.format_exc()
        if suffix == 'debug':
            html = '<html><head></head><body><pre>\n'
            html += traceback.format_exc()
            html += '\n</pre></body></html>'
            return html
        else:
            raise
    response.headers['Access-Control-Allow-Origin'] = '*'
    return response

@app.route('/data')
def show_datasets():
    html = '<html><head></head><body><h1>Available datasets:</h1>\n'
    for ds in list_datasets():
        html += '<a href="data/{ds}">{ds}</a><br>\n'.format(**locals())
    html += '</body></html>'
    return html

@app.route('/data/census2010_block2010')
def show_dataset_columns_2010():
    return open('show-2010-hierarchy.html').read()

@app.route('/data/<dataset>')
def show_dataset_columns(dataset):
    try:
        columns = list_columns(dataset)
        if dataset == 'census2000_block2010':
            columns = [c for c in columns if c == c.upper()]
        html = '<html><head></head><body>'
        html += '<a href="../data">Back to all datasets</a><br>'
        html += '<h1>Columns in dataset {dataset}:</h1>\n'.format(**locals())
        for col in columns:
            html += '{col}<br>\n'.format(**locals())
        html += '</body></html>'
        return html
    except InvalidUsage, e:
        return flask.Response('<h2>400 Invalid Usage</h2>' + e.message, status=400)
    except:
        print traceback.format_exc()
        raise

@app.route('/')
def hello():
    return """
<html><head></head><body>
Test tiles:<br>
<a href="/tilesv1/%230000ff;min(census2000_block2010.p001001%2Ccensus2010_block2010.p001001);;%23ff0000;max(0%2Ccensus2000_block2010.p001001-census2010_block2010.p001001);;%2300ff00;max(0%2Ccensus2010_block2010.p001001-census2000_block2010.p001001)/0/0/0.debug">Pop change 2000-2010 0/0/0</a>
"""
 
@app.route('/test')
def test_1990():
    return open('test-1990-hierarchy.html').read()

@app.route('/assets/<filename>')
def get_asset(filename):
    return open('assets/' + filename).read()

#app.run(host='0.0.0.0', port=5000)

if __name__ == '__main__':
    with app.test_request_context(sys.argv[1]):
        response = app.full_dispatch_request()
        print response.status_code
        print response.get_data()
        
