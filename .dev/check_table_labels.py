import glob
import io
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

for f in sorted(glob.glob('.dev/preview-*.html')):
    s = io.open(f, encoding='utf-8').read()
    for m in re.finditer(r'<table class="([^"]+)"', s):
        start = m.start()
        end = s.find('</table>', start)
        block = s[start:end]
        n_td = len(re.findall(r'<td[^>]*>', block))
        n_lbl = len(re.findall(r'<td[^>]*data-label=', block))
        flag = '' if n_td == n_lbl else '  <-- GAP'
        print('%-30s %-46s tds=%-3d labelled=%-3d%s' % (
            os.path.basename(f), m.group(1), n_td, n_lbl, flag))
