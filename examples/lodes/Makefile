get_random_census_block_points_from_prototiles: get_random_census_block_points_from_prototiles.cpp
	g++ -Wall get_random_census_block_points_from_prototiles.cpp -o get_random_census_block_points_from_prototiles
	time ./get_random_census_block_points_from_prototiles

test2000cols:
	./tileserve.py 'http://dotmaptiles.createlab.org:8888/data/census2000_block2010'

test2010cols:
	./tileserve.py 'http://dotmaptiles.createlab.org:8888/data/census2010_block2010'


testlist:
	./tileserve.py 'http://dotmaptiles.createlab.org:8888/data/xxx'
	./tileserve.py 'http://dotmaptiles.createlab.org:8888/data/lodes2007'
	./tileserve.py 'http://dotmaptiles.createlab.org:8888/data'

test1990:
	./tileserve.py 'http://dotmaptiles.createlab.org:8888/test'
	./tileserve.py 'http://dotmaptiles.createlab.org:8888/assets/all.json'


testcolor400:
	./tileserve.py 'http://dotmaptiles.createlab.org:8888/tilesv1/%2300ff00;census2010_block2010.p012028%2Bcensus2010_block2010.p012029%2Bcensus2010_block2010.p012030;;%23fff0000;census2010_block2010.p012004%2Bcensus2010_block2010.p012005%2Bcensus2010_block2010.p012006/10/244/390.debug'

test400: testcolor400
	./tileserve.py 'http://dotmaptiles.createlab.org:8888/tilesv1/%2300ff00;census2010_block2010XX.p043035;;%23ff0000;census2010_block2010.p043045;;%23ffff00;census2010_block2010.p043055/2/2/3.bin'
	./tileserve.py 'http://dotmaptiles.createlab.org:8888/tilesv1/%2300ff00;census2010_block2010.p43035;;%23ff0000;census2010_block2010.p043045;;%23ffff00;census2010_block2010.p043055/2/2/3.bin'
	./tileserve.py 'http://dotmaptiles.createlab.org:8888/tilesv1/%2300ff00;census2010_block2010.p012028***census2010_block2010.p012029%2Bcensus2010_block2010.p012030;;%23ff0000;census2010_block2010.p012004%2Bcensus2010_block2010.p012005%2Bcensus2010_block2010.p012006/10/244/390.debug'
	./tileserve.py 'http://dotmaptiles.createlab.org:8888/tilesv1/%230000ff;maan(census2000_block2010.p001001%2Ccensus2010_block2010.p001001);;%23ff0000;max(0%2Ccensus2000_block2010.p001001-census2010_block2010.p001001);;%2300ff00;max(0%2Ccensus2010_block2010.p001001-census2000_block2010.p001001)/0/0/0.debug'
	./tileserve.py 'http://dotmaptiles.createlab.org:8888/tilesv1/%2300ff00;census2010_block2010.p012028%2Bcensus2010_block2010.p012029%2Bcensus2010_block2010.p012030;;%23fff0000;census2010_block2010.p012004%2Bcensus2010_block2010.p012005%2Bcensus2010_block2010.p012006/10/244/390.debug'

test:
	./tileserve.py 'http://dotmaptiles.createlab.org:8888/tilesv1/%2300ff00;census2010_block2010.p012028%2Bcensus2010_block2010.p012029%2Bcensus2010_block2010.p012030;;%23ff0000;census2010_block2010.p012004%2Bcensus2010_block2010.p012005%2Bcensus2010_block2010.p012006/10/244/390.debug'
	./tileserve.py 'http://dotmaptiles.createlab.org:8888/tilesv1/%230000ff;min(census2000_block2010.p001001%2Ccensus2010_block2010.p001001);;%23ff0000;max(0%2Ccensus2000_block2010.p001001-census2010_block2010.p001001);;%2300ff00;max(0%2Ccensus2010_block2010.p001001-census2000_block2010.p001001)/0/0/0.debug'

