import io
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

t = io.open(r'src\pages\Dashboard\Dashboard.jsx', encoding='utf-8').read()
a = t.find('<table className="db-inv">')
b = t.find('<div className="db-grid">')
seg = t[a:b]

missing = re.findall(r'<td\b[^>]*>.*?</td>', seg, re.S)
bad = [m for m in missing if 'db-cell__v' not in m]
print('td blocks=%d  missing span=%d  spans=%d'
      % (len(missing), len(bad), seg.count('db-cell__v')))
for x in bad:
    print('  BAD:', ' '.join(x.split())[:160])
