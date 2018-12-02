#!/usr/bin/env python

import sys, traceback

from urllib2 import parse_http_list as _parse_list_header

import ast, datetime, flask, functools, glob, gzip, hashlib, json, math, md5, numpy, os, psycopg2, random, resource, re
import scipy.misc, StringIO, struct, subprocess, sys, tempfile, threading, time, urlparse

from dateutil import tz
from flask import after_this_request, request
from cStringIO import StringIO as IO

def cputime_ms():
    resources = resource.getrusage(resource.RUSAGE_SELF)
    return 1000.0 * (resources.ru_utime + resources.ru_stime)

def vmsize_gb():
    return float([l for l in open('/proc/%d/status' % os.getpid()).readlines() if l.startswith('VmSize:')][0].split()[1])/1e6

def log(msg):
    date = datetime.datetime.now(tz.tzlocal()).strftime('%Y-%m-%d %H:%M:%S%z')
    logfile.write('%s %5d %.3fGB: %s\n' % (date, os.getpid(), vmsize_gb(), msg))
    logfile.flush()

# Choose logfile by running uwsgi with --logto PATH
logfile = sys.stderr

if '__file__' in globals():
    log('Starting, path ' + os.path.abspath(__file__))
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

# packs to the range 0 ... 256^3-1
def unpack_color(f):
    b = floor(f / 256.0 / 256.0)
    g = floor((f - b * 256.0 * 256.0) / 256.0)
    r = floor(f - b * 256.0 * 256.0 - g * 256.0)
    return {'r':r,'g':g,'b':b}

def pack_color(color, encoding=numpy.float32):
    if encoding == numpy.float32:
        return color['r'] + color['g'] * 256.0 + color['b'] * 256.0 * 256.0;
    else:
        # Return with alpha = 255
        # Correct for PNG
        return 0xff000000 + color['b'] * 0x10000 + color['g'] * 0x100 + color['r']
        # Trying for MP4
        #return 0xff000000 + color['r'] * 0x10000 + color['g'] * 0x100 + color['b']

def parse_color(color, encoding=numpy.float32):
    color = color.strip()
    c = color
    try:
        if c[0] == '#':
            c = c[1:]
        if len(c) == 3:
            return pack_color({'r': 17 * int(c[0:1], 16),
                               'g': 17 * int(c[1:2], 16),
                               'b': 17 * int(c[2:3], 16)},
                               encoding)
        if len(c) == 6:
            return pack_color({'r': int(c[0:2], 16),
                               'g': int(c[2:4], 16),
                               'b': int(c[4:6], 16)},
                               encoding)
    except:
        pass
    raise InvalidUsage('Cannot parse color <code><b>%s</b></code> from spreadsheet.<br><br>Color must be in standard web form, <code><b>#RRGGBB</b></code>, where RR, GG, and BB are each two-digit hexadecimal numbers between 00 and FF.<br><br>See <a href="https://www.w3schools.com/colors/colors_picker.asp">HTML Color Picker</a>' % color)

def parse_colors(colors, encoding=numpy.float32):
    packed = [parse_color(color, encoding) for color in colors]
    return numpy.array(packed, dtype = encoding)

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

class InvalidUsage(Exception):
    def __init__(self, message):
        self.message = message

cache_dir = 'columncache'

def list_datasets():
    return [x for x in sorted(os.listdir(cache_dir)) if not '_hidden' in x]

# Compute relative path from request to /data
def dataroot():
    return '../' * len(request.path.split('/')) + 'data'

def list_columns(dataset):
    dir = '{cache_dir}/{dataset}'.format(cache_dir=cache_dir, **locals())
    if not os.path.exists(dir):
        msg = 'Dataset named "{dataset}" not found.<br><br><a href="{dataroot}">List valid datasets</a>'.format(dataroot=dataroot(), **locals())
        raise InvalidUsage(msg)
    return sorted([os.path.basename(os.path.splitext(c)[0]) for c in (glob.glob(dir + '/*.float32') + glob.glob(dir + '/*.numpy'))])

# Removing the least recent takes O(N) time;  could be make more efficient if needed for larger dicts

class LruDict:
    def __init__(self, max_entries):
        self.max_entries = max_entries
        self.entries = {}
        self.usecount = 0
    
    def has(self, key):
        return key in self.entries
    
    def get(self, key):
        self.use(key)
        return self.entries[key]['data']
    
    def use(self, key):
        self.usecount += 1
        self.entries[key]['lastuse'] = self.usecount

    def insert(self, key, val):
        self.entries[key] = {'data':val}
        self.use(key)
        if len(self.entries) > self.max_entries:
            lru_key, lru_val = None, None
            for key, val in self.entries.iteritems():
                if not lru_val or val['lastuse'] < lru_val['lastuse']:
                    lru_key, lru_val = key, val
            if lru_val:
                del self.entries[lru_key]

column_cache = LruDict(100) # max entries

def map_as_array(path):
    return numpy.memmap(path, dtype=numpy.float32, mode='r')

def load_column(dataset, column):
    cache_key = '{dataset}.{column}'.format(**locals())
    if column_cache.has(cache_key):
        return column_cache.get(cache_key)
    dir = '{cache_dir}/{dataset}'.format(cache_dir=cache_dir, **locals())
    if not os.path.exists(dir):
        msg = 'Dataset named "{dataset}" not found.<br><br><a href="{dataroot}">List valid datasets</a>'.format(dataroot=dataroot(), **locals())
        raise InvalidUsage(msg)
    cache_filename_prefix = dir + '/' + column
    cache_filename = cache_filename_prefix + '.float32'
    if not os.path.exists(cache_filename):
        if not os.path.exists(cache_filename_prefix + '.numpy'):
            msg = ('Column named "{column}" in dataset "{dataset}" not found.<br><br>'
                   '<a href="{dataroot}/{dataset}">List valid columns from {dataset}</a>').format(
                dataroot=dataroot(), **locals())
                   
            raise InvalidUsage(msg)
        data = numpy.load(open(cache_filename_prefix + '.numpy')).astype(numpy.float32)
        tmpfile = cache_filename + '.tmp.%d.%d' % (os.getpid(), threading.current_thread().ident)
        data.tofile(tmpfile)
        os.rename(tmpfile, cache_filename)

    data = map_as_array(cache_filename)
    column_cache.insert(cache_key, data)
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


expression_cache = LruDict(50) # 

def eval_layer_column(expr):
    cache_key = hashlib.sha256(expr).hexdigest()
    if expression_cache.has(cache_key):
        return expression_cache.get(cache_key)

    cache_filename = 'expression_cache/{cache_key}.float32'.format(**locals())
    
    if not os.path.exists(cache_filename):
        try:
            expr = expr.replace(' DIV ', '/')
            data = eval_(ast.parse(expr, mode='eval').body).astype(numpy.float32)
        except SyntaxError,e:
            raise InvalidUsage('<pre>' + traceback.format_exc(0) + '</pre>')
        
        try:
            os.mkdir('expression_cache')
        except:
            pass
        
        tmpfile = cache_filename + '.tmp.%d.%d' % (os.getpid(), threading.current_thread().ident)
        data.tofile(tmpfile)
        os.rename(tmpfile, cache_filename)
    
    data = map_as_array(cache_filename)
    expression_cache.insert(cache_key, data)
    return data    

#def assemble_cols(cols):
#    return numpy.hstack([c.reshape(len(c), 1) for c in cols]).astype(numpy.float32)

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
#include <stdint.h>
#include <stdlib.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/mman.h>
#include <stdio.h>
#include <errno.h>

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

typedef struct {
  unsigned char r, g, b, a;
} __attribute__ ((packed)) RGBA8;

RGBA8 black = {0,0,0,0};

int compute_tile_data(
    const char *prototile_path,
    int incount,
    TileRecord *tile_data,
    int tile_data_length,
    float **populations,
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
    if (p == MAP_FAILED) return -2000 + errno;

    unsigned outcount = 0;
    for (unsigned i = 0; i < incount; i++) {
        PrototileRecord rec = p[i];
        double seq = rec.seq;
        seq += 0.5;
        for (unsigned c = 0; c < pop_cols; c++) {
            seq -= populations[c][rec.blockIdx];
            if (seq < 0) {
                if (outcount >= incount) return -4;
                tile_data[outcount].x = rec.x;
                tile_data[outcount].y = rec.y;
                tile_data[outcount].color = colors[c];
                outcount++;
                break;
            }
        }
    }
    munmap(p, incount*sizeof(PrototileRecord));
    close(fd);
    return outcount;
}

inline int min(int x, int y) { return x < y ? x : y; }
inline int max(int x, int y) { return x > y ? x : y; }

#include <math.h>

float sumsq(float a, float b) { return a*a + b*b; }


// Negative on fail
int compute_tile_data_box(
    const char *prototile_path,
    int incount,
    unsigned char *tile_box_pops, // [x * y * colors]
    int tile_width_in_boxes, // width=height
    float **populations,
    unsigned int pop_rows,
    unsigned int pop_cols,
    float min_x, float min_y, float max_x, float max_y,
    float level,
    float *block_areas,
    float prototile_subsample)
{
    unsigned char *tile_box_sums = NULL;
    int fd = open(prototile_path, O_RDONLY);
    if (fd < 0) return -1;

    PrototileRecord *p = mmap (0, incount*sizeof(PrototileRecord),
                               PROT_READ, MAP_SHARED, fd, 0);
    if (p == MAP_FAILED) return -2000 + errno;

    unsigned outcount = 0;
    int first = 1;

    tile_box_sums = calloc(tile_width_in_boxes * tile_width_in_boxes, 1);
    for (unsigned i = 0; i < incount; i++) {
        // rec is a single prototile dot.  We need to figure out which population it belongs to, if any, and
        // assign color accordingly
        PrototileRecord rec = p[i];

        double block_population = 0.0; // Total population in this block, across all colors/columns
        for (unsigned c = 0; c < pop_cols; c++) {
            block_population += populations[c][rec.blockIdx];
        }
        //// This is the total # of pixels to draw, across all prototiles at this Z level
        //double block_uncorrected_pixels_to_draw = block_population * prototile_subsample * (radius * 2) * (radius * 2);
        //
        //// level 0 pixels are 156543 meters across
        //double level_0_pixel_size = 156543; // meters
        //double size_of_block_in_pixels = block_areas[rec.blockIdx] * pow(4.0, level) / (level_0_pixel_size * level_0_pixel_size) * 40;
        //
        //// blockSubsample of 0.5 means show half the points
        ////double blockSubsample = 1.0 / (1.0 + block_uncorrected_pixels_to_draw / size_of_block_in_pixels);
        //double blockSubsample = 1.0 / (1.0 + sqrt(block_uncorrected_pixels_to_draw / size_of_block_in_pixels));
        //
        ////blockSubsample = 1.0;
        //
        //if (/*rec.blockIdx == 9501143 &&*/ first) {
        //    fprintf(stderr, "ctdp z=%f, seq=%d, prototile_subsample=%f, blockSubsample=%lf, b_uncorrected_pix_to_draw=%lf, size_of_block_pixels=%lf, radius=%f\\n", 
        //            level, rec.blockIdx, prototile_subsample, blockSubsample, 
        //            block_uncorrected_pixels_to_draw, size_of_block_in_pixels, radius);
        //    first = 0;
        //}
        //double seq = rec.seq / blockSubsample + 0.5;
        
        double seq = rec.seq + 0.5;

        for (unsigned c = 0; c < pop_cols; c++) {
            // Loop until we find the right population column for rec (if any)
            seq -= populations[c][rec.blockIdx];
            if (seq < 0) {
                // Prototile dot belongs in population column "c".  Draw with appropriate color
                if (outcount >= incount) {
                  free(tile_box_sums);
                  return -4;  // Illegal
                }

                // x and y are in original projection space (0-256 defines the world)
                // row and col are in box space for the returned tile (0 to tile_width_in_boxes-1)

                // Transform from prototile x,y which are 0.0-255.999999... web mercator coords
                // Transform to box coords for this tile which are row, col

                int col = (rec.x - min_x) / (max_x - min_x) * tile_width_in_boxes;
                int row = (rec.y - min_y) / (max_y - min_y) * tile_width_in_boxes;
                if (0 <= col && col < tile_width_in_boxes && 
                    0 <= row && row < tile_width_in_boxes) {
                    int sums_idx = row * tile_width_in_boxes + col;
                    // Only increment until the overall population in a box sums to 255
                    if (tile_box_sums[sums_idx] < 255) {
                        tile_box_sums[sums_idx]++;
                        int idx = (c * tile_width_in_boxes * tile_width_in_boxes) + sums_idx;
                        tile_box_pops[idx]++;
                    }
                }
                break;
            }
        }
    }
    munmap(p, incount*sizeof(PrototileRecord));
    close(fd);
    free(tile_box_sums);
    return 0;
}

// Negative on fail
int compute_tile_data_png(
    const char *prototile_path,
    int incount,
    RGBA8 *tile_pixels,
    int tile_width_in_pixels, // width=height
    float **populations,
    unsigned int pop_rows,
    unsigned int pop_cols,
    RGBA8 *colors,
    float min_x, float min_y, float max_x, float max_y,
    float radius,
    float level,
    float *block_areas,
    float prototile_subsample)
{
    if (incount == 0) return 0;
    int fd = open(prototile_path, O_RDONLY);
    if (fd < 0) return -1;

    PrototileRecord *p = mmap (0, incount*sizeof(PrototileRecord),
                               PROT_READ, MAP_SHARED, fd, 0);
    if (p == MAP_FAILED) return -2000 + errno;

    unsigned outcount = 0;
    int first = 1;

    for (unsigned i = 0; i < incount; i++) {
        // rec is a single prototile dot.  We need to figure out which population it belongs to, if any, and
        // assign color accordingly
        PrototileRecord rec = p[i];

        double block_population = 0.0; // Total population in this block, across all colors/columns
        for (unsigned c = 0; c < pop_cols; c++) {
            block_population += populations[c][rec.blockIdx];
        }
        // This is the total # of pixels to draw, across all prototiles at this Z level
        double block_uncorrected_pixels_to_draw = block_population * prototile_subsample * (radius * 2) * (radius * 2);

        // level 0 pixels are 156543 meters across
        double level_0_pixel_size = 156543; // meters
        double size_of_block_in_pixels = block_areas[rec.blockIdx] * pow(4.0, level) / (level_0_pixel_size * level_0_pixel_size) * 40;

        // blockSubsample of 0.5 means show half the points
        //double blockSubsample = 1.0 / (1.0 + block_uncorrected_pixels_to_draw / size_of_block_in_pixels);
        double blockSubsample = 1.0 / (1.0 + sqrt(block_uncorrected_pixels_to_draw / size_of_block_in_pixels));

        //blockSubsample = 1.0;

        if (/*rec.blockIdx == 9501143 &&*/ first) {
            fprintf(stderr, "ctdp z=%f, seq=%d, prototile_subsample=%f, blockSubsample=%lf, b_uncorrected_pix_to_draw=%lf, size_of_block_pixels=%lf, radius=%f\\n", 
                    level, rec.blockIdx, prototile_subsample, blockSubsample, 
                    block_uncorrected_pixels_to_draw, size_of_block_in_pixels, radius);
            first = 0;
        }

        //double seq = rec.seq / blockSubsample + 0.5;
        double seq = rec.seq / blockSubsample + 0.999;

        for (unsigned c = 0; c < pop_cols; c++) {
            // Loop until we find the right population column for rec (if any)
            seq -= populations[c][rec.blockIdx];
            if (seq < 0) {
                // Prototile dot belongs in population column "c".  Draw with appropriate color
                if (outcount >= incount) return -4;  // Illegal

                // render the point so long as we're within the pixel range of the tile
                // x and y are in original projection space (0-256 defines the world)
                // row and col are in pixel space for the returned tile (0 to tile_width_in_pixels-1)

                // Transform from prototile x,y which are 0.0-255.999999... web mercator coords
                // Transform to pixel coords for this tile which are row, col

                // center_row, col are increased by 0.5 so that (int) behaves like round instead of floor
                float center_col = (rec.x - min_x) / (max_x - min_x) * tile_width_in_pixels + 0.5;
                float center_row = (rec.y - min_y) / (max_y - min_y) * tile_width_in_pixels + 0.5;

                // For more details, see below

                int min_col = max((int) (center_col - radius), 0);
                int min_row = max((int) (center_row - radius), 0);  
                int max_col = min((int) (center_col + radius), tile_width_in_pixels);
                int max_row = min((int) (center_row + radius), tile_width_in_pixels);
                for (int col = min_col; col < max_col; col++) {
                    for (int row = min_row; row < max_row; row++) {
                        tile_pixels[row * tile_width_in_pixels + col] = colors[c];
                    }
                }
                break;
            }
        }
    }
    munmap(p, incount*sizeof(PrototileRecord));
    close(fd);
    return 0;
}

                // Leftmost pixel stretches from 0 <= col < 1
                // Center of the leftmost pixel is col=0.5

                // Rightmost pixel stretch from tile_width_in_pixels-1 <= col < tile_width_in_pixels
                // Center of the rightmost pixel is col=tile_width_in_pixels-0.5

                // Test case, generating tile 0/0/0:  rec.x = 0, min_x = 0, max_x = 512
                // center_col = (0 - 0) / (256 - 0) * 512 + 0.5 = 0.5
                // min_col = int(0.5-0.5) = 0;  max_col = int(0.5+0.5) = 1
                // colors pixel 0, good

                // Test case, generating tile 0/0/0:  rec.x = .499, min_x = 0, max_x = 512
                // center_col = (.499 - 0) / (256 - 0) * 512 + 0.5 = 1.498
                // min_col = int(1.498 - 0.5) = 0;  max_col = int(1.498 + 0.5) = 1
                // colors pixel 0, good

                // Test case, generating tile 0/0/0:  rec.x = 255.99, min_x = 0, max_x = 512
                // center_col = (255.99 - 0) / (256 - 0) * 512 + 0.5 = 512.48
                // min_col = int(512.48 - 0.5) = 511
                // max_col = int(512.48 + 0.5) = 512
                // colors pixel 511, good
""")

def compute_tile_data_c(prototile_path, incount, tile, populations, colors):
    assert(populations[0].dtype == numpy.float32)
    assert(colors.dtype == numpy.float32)
    return compute_tile_data_ext.compute_tile_data(
        prototile_path,
        int(incount),
        to_ctype_reference(tile),
        len(tile),
        to_ctype_reference(populations),
        populations[0].size, len(populations),
        to_ctype_reference(colors))

def compute_tile_data_png(prototile_path, incount, tile_pixels, tile_width_in_pixels, populations, colors_rgba8,
                          min_x, min_y, max_x, max_y, radius, level, block_areas, prototile_subsample):
    assert(populations[0].dtype == numpy.float32)
    assert(colors_rgba8.dtype == numpy.uint32)
    return compute_tile_data_ext.compute_tile_data_png(
        prototile_path,
        int(incount),
        to_ctype_reference(tile_pixels),
        tile_width_in_pixels,
        to_ctype_reference(populations),
        populations[0].size, len(populations),
        to_ctype_reference(colors_rgba8),
        ctypes.c_float(min_x),
        ctypes.c_float(min_y),
        ctypes.c_float(max_x),
        ctypes.c_float(max_y),
        ctypes.c_float(radius),
        ctypes.c_float(level),
        to_ctype_reference(block_areas),
        ctypes.c_float(prototile_subsample))

def compute_tile_data_box(prototile_path, incount, tile_box_pops, tile_width_in_boxes, populations,
                          min_x, min_y, max_x, max_y, level, block_areas, prototile_subsample):
    assert(populations[0].dtype == numpy.float32)
    return compute_tile_data_ext.compute_tile_data_box(
        prototile_path,
        int(incount),
        to_ctype_reference(tile_box_pops),
        tile_width_in_boxes,
        to_ctype_reference(populations),
        populations[0].size, len(populations),
        ctypes.c_float(min_x),
        ctypes.c_float(min_y),
        ctypes.c_float(max_x),
        ctypes.c_float(max_y),
        ctypes.c_float(level),
        to_ctype_reference(block_areas),
        ctypes.c_float(prototile_subsample))

def generate_tile_data_pixmap(layer, z, x, y, tile_width_in_pixels, format):
    # Load block area column
    block_areas = load_column('geometry_block2010', 'area_web_mercator_sqm')

    z = int(z)
    x = int(x)
    y = int(y)
    start_time = time.time()
    max_prototile_level = 10
    if z <= max_prototile_level:
        pz = z
        px = x
        py = y
    else:
        pz = max_prototile_level
        px = int(x / (2 ** (z - max_prototile_level)))
        py = int(y / (2 ** (z - max_prototile_level)))
        
    # remove block # and seq #, add color
    
    prototile_path = 'prototiles/%d/%d/%d.bin' % (pz, px, py)
    incount = os.path.getsize(prototile_path) / prototile_record_len

    # subsampling factors already baked into prototiles, from C02 Generate prototiles.ipynb

    prototile_subsamples = [
        0.001, # level 0
        0.001,
        0.001,
        0.001,
        0.001,
        0.001,
        0.004,
        0.016,
        0.064,
        0.256,
        1.0    # level 10
    ]
    prototile_subsample = 1
    if z < len(prototile_subsamples):
        prototile_subsample = prototile_subsamples[z]

    if z < 5:
        # Further subsample the points
        subsample = 2.0 ** ((5.0 - z) / 2.0)  # z=4, subsample=2;  z=3, subsample=4 ...
        # We're further subsampling the prototile
        prototile_subsample /= subsample
        incount = int(incount / subsample)
    

    local_tile_width = 256.0 / 2 ** int(z)
    min_x = int(x) * local_tile_width
    max_x = min_x + local_tile_width
    min_y = int(y) * local_tile_width
    max_y = min_y + local_tile_width


    # z=10, r=0.5, area=1
    # z=11, r=sqrt(2)/2, area=2
    # z=12, 1, area=4
    # z=13, sqrt(2), area=8
    
    if z <= 10:
        radius = 0.5
    else:
        #radius = 2 ** (z-11)  # radius 1 for z=11.  radius 2 for z=12.  radius 4 for z=13
        radius = 2 ** ((z-12)/2.0)  # radius 1 for z=11.  radius 2 for z=12.  radius 4 for z=13

    if format == 'box':
        tile_data = numpy.zeros((len(layer['colors_rgba8']), tile_width_in_pixels, tile_width_in_pixels), dtype=numpy.uint8)
        print('about to compute_tile_data_box ', layer['colors_rgba8'])
        if incount > 0:
            status = compute_tile_data_box(prototile_path, incount, tile_data, tile_width_in_pixels,
                                           layer['populations'],
                                           min_x, min_y, max_x, max_y, 
                                           z, block_areas, prototile_subsample)
        else:
            status = 0
    else:
        bytes_per_pixel = 4 # RGBA x 8-bit
        tile_data = numpy.zeros((tile_width_in_pixels, tile_width_in_pixels, bytes_per_pixel), dtype=numpy.uint8)
        print('about to compute_tile_data_png ', layer['colors_rgba8'])
        if incount > 0:
            status = compute_tile_data_png(prototile_path, incount, tile_data, tile_width_in_pixels,
                                           layer['populations'], layer['colors_rgba8'],
                                           min_x, min_y, max_x, max_y, radius,
                                           z, block_areas, prototile_subsample)
        else:
            status = 0
    if status < 0:
        raise Exception('compute_tile_data returned error %d.  path %s %d' % (status, prototile_path, incount))

    duration = int(1000 * (time.time() - start_time))
    log('{z}/{x}/{y}: {duration}ms to create pixmap tile from prototile'.format(**locals()))

    return tile_data


def gzip_buffer(buf, compresslevel=1):
    str = StringIO.StringIO()
    out = gzip.GzipFile(fileobj=str, mode='wb', compresslevel=compresslevel)
    out.write(buf)
    out.flush()
    return str.getvalue()

def generate_tile_data_png_or_box(layer, z, x, y, tile_width_in_pixels, format):
    tile_data = generate_tile_data_pixmap(layer, z, x, y, tile_width_in_pixels, format)
    if format == 'png':
        out = StringIO.StringIO()
        scipy.misc.imsave(out, tile_data, format='png')
        png = out.getvalue()
        return png
    else:
        return tile_data.tobytes()
    
def generate_tile_data_mp4(layers, z, x, y, tile_width_in_pixels):
    # make ffmpeg

    cmd = ['/usr/bin/ffmpeg']
    # input from stdin, rgb24
    cmd += ['-pix_fmt', 'rgba', '-f', 'rawvideo', '-s', '%dx%d' % (tile_width_in_pixels, tile_width_in_pixels), '-i', 'pipe:0', '-r', '10']
    # output encoding
    #cmd += ['-vcodec', 'libx264', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-crf', '20', '-g', '10', '-bf', '0']
    cmd += ['-vcodec', 'libx264', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-crf', '20']
    #cmd += ['-vcodec', 'libx264', '-preset', 'slow', '-pix_fmt', 'yuv444p', '-crf', '20']

    #cmd += ['-c:v', 'libvpx-vp9', '-crf', '35', '-threads', '8', '-b:v', '10000k', '-pix_fmt', 'yuv444p']

    
    cmd += ['-movflags',  'faststart'] # move TOC to beginning for fast streaming

    video_path = '/tmp/tile.%d.%s.mp4' % (os.getpid(), threading.current_thread().name)
    #video_path = '/tmp/tile.%d.%s.webm' % (os.getpid(), threading.current_thread().name)
    
    cmd += ['-y', video_path]

    log('about to start ffmpeg')
    before_time = time.time()
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=sys.stderr, stderr=sys.stderr)
    log('started ffmpeg')

    for frameno in range(0, len(layers)):
        layer = layers[frameno]
        tile_pixels = generate_tile_data_pixmap(layer, z, x, y, tile_width_in_pixels, 'mp4')
        log('about to spoot frame %d of len %d' % (frameno, len(tile_pixels)))
        p.stdin.write(tile_pixels)
        log('done')
        #(out, err) = p.communicate(tile_pixels)
        #log('saw out:%s err:%s' % (out, err))

    p.stdin.flush()
    p.stdin.close()
    ret = p.wait()
    encoding_time = time.time() - before_time
    video_contents = open(video_path).read()
    os.unlink(video_path)
    log('%s/%s/%s VIDSIZE %dKB TIME %.1fs CMD %s' % (z, x, y, int(len(video_contents)/1024), encoding_time, ' '.join(cmd)))
    
    return video_contents
    
def generate_tile_data(layer, z, x, y, use_c=False):
    start_time = time.time()
    # remove block # and seq #, add color
    
    prototile_path = 'prototiles/{z}/{x}/{y}.bin'.format(**locals())
    incount = os.path.getsize(prototile_path) / prototile_record_len
    
    # Preallocate output array for returned tile
    tile = bytearray(tile_record_len * incount)

    if incount > 0:
        if use_c:
            ctd = compute_tile_data_c
        else:
            ctd = compute_tile_data_python
        
        outcount = ctd(prototile_path, incount, tile, layer['populations'], layer['colors'])
    else:
        outcount = 0

    if outcount < 0:
        raise Exception('compute_tile_data returned error %d' % outcount)

    duration = int(1000 * (time.time() - start_time))
    log('{z}/{x}/{y}: {duration}ms to create tile from prototile'.format(**locals()))

    return tile[0 : outcount * tile_record_len]

layer_cache = LruDict(50) # max entries

def find_or_generate_layer(layerdef):
    if layer_cache.has(layerdef):
        print 'Using cached {layerdef}'.format(**locals())
        return layer_cache.get(layerdef)

    start_time = time.time()
    start_cputime_ms = cputime_ms()
    
    layerdef_hash = md5.new(layerdef).hexdigest()
    log('{layerdef_hash}: computing from {layerdef}'.format(**locals()))
    colors = []
    populations = []
    for (color, expression) in [x.split(';') for x in layerdef.split(';;')]:
        colors.append(color)
        populations.append(eval_layer_column(expression))

    layer = {'populations': populations,
             'colors': parse_colors(colors, encoding=numpy.float32),
             'colors_rgba8': parse_colors(colors, encoding=numpy.uint32)}
    layer_cache.insert(layerdef, layer)
    duration = int(1000 * (time.time() - start_time))
    cpu = cputime_ms() - start_cputime_ms
    log('{layerdef_hash}: {duration}ms ({cpu}ms CPU) to create'.format(**locals()))
    return layer

@app.route('/tilesv1/<layersdef>/512x512/<z>/<x>/<y>.mp4')
def serve_video_tile_v1_mp4(layersdef, z, x, y):
    x = int(int(x) / 4)
    y = int(int(y) / 4)
    (x,y)=(y,x)
    try:
        layers = [find_or_generate_layer(layer) for layer in layersdef.split(';;;')]
        tile_width_in_pixels = 1024
        tile = generate_tile_data_mp4(layers, z, x, y, tile_width_in_pixels)
        
        #response = flask.Response(tile, mimetype='video/mp4')
        response = flask.Response(tile, mimetype='video/webm')
    except InvalidUsage, e:
        response = flask.Response('<h2>400 Invalid Usage</h2>' + e.message, status=400)
    except:
        print traceback.format_exc()
        raise
    response.headers['Access-Control-Allow-Origin'] = '*'
    return response

@app.route('/tilesv1/<layerdef>/<z>/<x>/<y>.png')
def serve_tile_v1_png(layerdef, z, x, y):
    try:
        layer = find_or_generate_layer(layerdef)
        tile_width_in_pixels = 512
        tile = generate_tile_data_png_or_box(layer, z, x, y, tile_width_in_pixels, 'png')
        outcount = len(tile) / tile_record_len
        
        response = flask.Response(tile, mimetype='image/png')
    except InvalidUsage, e:
        response = flask.Response('<h2>400 Invalid Usage</h2>' + e.message, status=400)
    except:
        print traceback.format_exc()
        raise
    response.headers['Access-Control-Allow-Origin'] = '*'
    return response

# .box is the new tile format
@app.route('/tilesv1/<layerdef>/<z>/<x>/<y>.box')
@gzipped
def serve_tile_v1_box(layerdef, z, x, y):
    try:
        layer = find_or_generate_layer(layerdef)
        tile_width_in_pixels = 256
        tile = generate_tile_data_png_or_box(layer, z, x, y, tile_width_in_pixels, 'box')
        
        response = flask.Response(tile, mimetype='application/octet-stream')
    except InvalidUsage, e:
        response = flask.Response('<h2>400 Invalid Usage</h2>' + e.message, status=400)
    except:
        print traceback.format_exc()
        raise
    response.headers['Access-Control-Allow-Origin'] = '*'
    return response

# .bin is the first tile format, with every point enumerated, vector-style
@app.route('/tilesv1/<layerdef>/<z>/<x>/<y>.<suffix>')
@gzipped
def serve_tile_v1(layerdef, z, x, y, suffix):
    try:
        layer = find_or_generate_layer(layerdef)
        if suffix == 'box':
            tile = generate_tile_data_box(layer, z, x, y)
        else:
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

@app.route('/data/<dataset>')
def show_dataset_columns(dataset):
    description = '{cache_dir}/{dataset}/description.html'.format(cache_dir=cache_dir, **locals())
    html = '<html><head></head><body>'
    html += '<a href="../data">Back to all datasets</a><br>'
    if os.path.exists(description):
        html += open(description).read()
        html += '</body></html>'
        return html
    try:
        columns = list_columns(dataset)
        if dataset == 'census2000_block2010':
            columns = [c for c in columns if c == c.upper()]
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
        
