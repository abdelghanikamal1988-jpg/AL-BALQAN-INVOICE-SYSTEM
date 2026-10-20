import glob

BAD = b'\xc3\x82\xc2\xb7'
GOOD = b'\xc2\xb7'

for f in glob.glob(r'.dev\preview-*.html'):
    d = open(f, 'rb').read()
    if BAD in d:
        n = d.count(BAD)
        open(f, 'wb').write(d.replace(BAD, GOOD))
        print('fixed', n, f)
