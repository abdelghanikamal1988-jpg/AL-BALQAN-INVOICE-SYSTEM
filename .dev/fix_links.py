import re
import os
import glob

css_dir = 'dist/assets'
hash_css = sorted(
    (os.path.getmtime(os.path.join(css_dir, f)), f)
    for f in os.listdir(css_dir) if f.endswith('.css')
)[-1][1]
BUNDLE = f'<link rel="stylesheet" href="../dist/assets/{hash_css}" />'
print('bundle:', hash_css)

for p in sorted(glob.glob('.dev/preview-*.html')):
    s = open(p, encoding='utf-8').read()
    changed = False
    links = re.findall(r'\s*<link rel="stylesheet"[^>]*>', s)
    if links:
        for l in links:
            s = s.replace(l, '', 1)
            changed = True
        s = s.replace('<head>', '<head>\n  ' + BUNDLE, 1)
    elif 'dist/assets' not in s:
        s = s.replace('<head>', '<head>\n  ' + BUNDLE, 1)
        changed = True
    else:
        s, n = re.subn(r'(<link rel="stylesheet" href="\.\./dist/assets/)[^"]+(")', lambda m: m.group(1) + hash_css + m.group(2), s)
        if n:
            changed = True
    if 'name="viewport"' not in s:
        s = s.replace(
            '<meta charset',
            '<meta name="viewport" content="width=device-width, initial-scale=1" />\n  <meta charset',
            1,
        )
        changed = True
    if changed:
        open(p, 'w', encoding='utf-8').write(s)
        print('updated:', os.path.basename(p))
