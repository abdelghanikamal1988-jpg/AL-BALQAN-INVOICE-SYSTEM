import glob, io
fixes = [("â€™","'"),("â€œ",'"'),("â€\x9d",'"'),("â€”","—"),("â€“","–"),("â€¦","...")]
for p in glob.glob('.dev/preview-*.html'):
    s = io.open(p, encoding='utf-8', errors='ignore').read()
    o = s
    for a,b in fixes: s = s.replace(a,b)
    if s != o:
        io.open(p,'w',encoding='utf-8').write(s)
        print('fixed', p)
