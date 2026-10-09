import io
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

t = io.open(r'src\pages\Dashboard\Dashboard.jsx', encoding='utf-8').read()
pat = re.compile(r'<(section|div|main|footer)\b[^>]*className="([^"]*)"')
depth_hint = 0
for i, l in enumerate(t.split('\n'), 1):
    s = l.strip()
    m = pat.search(s)
    if m and ('db-' in m.group(2) or 'card' in m.group(2)):
        print(i, '|', m.group(1), '|', m.group(2))
    elif s.startswith('</section>'):
        print(i, '| CLOSE')
