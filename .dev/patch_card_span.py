"""Wrap every .db-inv cell value in <span class="db-cell__v"> so the stacked
phone cards can ellipsis/clamp values uniformly. Idempotent."""

import io
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

PATH = '.dev/preview-dashboard.html'
html = io.open(PATH, encoding='utf-8').read()

if 'db-cell__v' in html:
    print('already patched')
    raise SystemExit(0)


def patch_table(m):
    block = m.group(0)
    block = re.sub(
        r'(<td\b[^>]*>)([^<>]+)(</td>)',
        lambda mm: mm.group(1) + '<span class="db-cell__v">' + mm.group(2)
        + '</span>' + mm.group(3),
        block)
    block = re.sub(
        r'(<td\b[^>]*>)(<span class="db-badge[^"]*">.*?</span>)(</td>)',
        r'\1<span class="db-cell__v">\2</span>\3',
        block)
    return block


html, n = re.subn(r'<table class="db-inv">.*?</table>', patch_table, html, flags=re.S)
spans = html.count('db-cell__v')
io.open(PATH, 'w', encoding='utf-8', newline='\n').write(html)
print('tables=%d spans=%d' % (n, spans))
