#!/usr/bin/python

def exec_ipynb(url):
    import json, re, urllib2
    nb = (urllib2.urlopen(url) if re.match(r'https?:', url) else open(url)).read()
    exec '\n'.join([''.join(cell['input']) for cell in json.loads(nb)['worksheets'][0]['cells'] if cell['cell_type'] == 'code']) in globals()

exec_ipynb('mirror-all-tiles.ipynb')
