"""Verify data-label coverage in patched harnesses."""

import io
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

for f in ['.dev/preview-history.html', '.dev/preview-clients.html',
          '.dev/preview-pending.html', '.dev/preview-dashboard.html',
          '.dev/preview-admin.html', '.dev/preview-detail.html']:
    s = io.open(f, encoding='utf-8').read()
    print('=====', f)
    for m in re.finditer(r'<table class="([^"]+)"', s):
        print('  table:', m.group(1))
    for m in re.finditer(r'<tbody>(.*?)</tbody>', s, re.S):
        tr = re.search(r'<tr[^>]*>(.*?)</tr>', m.group(1), re.S)
        if not tr:
            continue
        tds = re.findall(r'<td[^>]*>', tr.group(1))
        labels = [re.search(r'data-label="([^"]*)"', td) for td in tds]
        missing = [td[:70] for td, l in zip(tds, labels) if not l]
        print('  row tds=%d labelled=%d missing=%s' % (
            len(tds), sum(1 for l in labels if l), missing))
