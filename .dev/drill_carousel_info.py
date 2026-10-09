import io
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

print('=== chevronRight path ===')
c = io.open('src/components/Icons/Icon.jsx', encoding='utf-8').read()
i = c.find('chevronRight')
print(c[i:i + 320])

print('=== en/common.js tail ===')
t = io.open('src/i18n/en/common.js', encoding='utf-8').read()
print(t[:700])

print('=== ar/common.js head ===')
t = io.open('src/i18n/ar/common.js', encoding='utf-8').read()
print(t[:700])

print('=== dashboard.css db-charts rule ===')
d = io.open('src/styles/dashboard.css', encoding='utf-8').read()
i = d.find('.db-charts {')
print(d[i:i + 300])

print('=== harness indentation of db-charts vs db-panel ===')
h = io.open('.dev/preview-dashboard.html', encoding='utf-8').read()
for m in re.finditer(r'(?m)^(\s*)<div class="db-charts">', h):
    print('db-charts indent', len(m.group(1)))
for m in re.finditer(r'(?m)^(\s*)<section class="card db-panel"', h):
    print('db-panel indent', len(m.group(1)))

print('=== early returns in Dashboard between 500 and 640 ===')
dd = io.open(r'src\pages\Dashboard\Dashboard.jsx', encoding='utf-8').read().split('\n')
for n in range(500, 645):
    s = dd[n - 1]
    if 'return' in s or s.strip().startswith('if ('):
        print(n, s.rstrip()[:130])
