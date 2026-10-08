import collections
import io
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

h = io.open('.dev/preview-dashboard.html', encoding='utf-8').read()
cls = collections.Counter()
for m in re.finditer(r'class="([^"]+)"', h):
    for c in m.group(1).split():
        cls[c] += 1
for c, n in sorted(cls.items()):
    if any(k in c for k in ['stat', 'hero', 'top', 'greet', 'page', 'chart',
                            'report', 'table', 'section', 'kpis', 'card']):
        print(c, n)
