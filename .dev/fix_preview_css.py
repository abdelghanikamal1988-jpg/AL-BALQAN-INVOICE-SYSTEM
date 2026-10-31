"""Point every .dev/preview-*.html at the newest built CSS bundle.

The previews are a static harness that loads the production stylesheet from
dist/assets. Vite hashes that filename, so any edit to a .css source changes
the hash and every preview silently loses its styling (which reads as a wall
of visual failures). This script rewrites the reference to the current build
so the harness keeps working after each build.

Usage:
  python .dev\\fix_preview_css.py
"""

import glob
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

css_files = glob.glob(os.path.join(ROOT, 'dist', 'assets', 'index-*.css'))
if not css_files:
    raise SystemExit('no built CSS found in dist/assets — run npm run build first')

newest = max(css_files, key=os.path.getmtime)
new_name = os.path.basename(newest)

pattern = re.compile(r'(assets/)index-[A-Za-z0-9_-]+\.css')

updated = 0
for path in glob.glob(os.path.join(HERE, 'preview-*.html')):
    with open(path, encoding='utf-8') as f:
        text = f.read()
    fixed, n = pattern.subn(r'\g<1>' + new_name, text)
    if n:
        with open(path, 'w', encoding='utf-8', newline='') as f:
            f.write(fixed)
        updated += 1

print('css bundle ->', new_name)
print('previews updated ->', updated)
