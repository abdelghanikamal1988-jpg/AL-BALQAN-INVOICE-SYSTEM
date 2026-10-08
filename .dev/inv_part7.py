"""Extract first tbody row of each db-inv table in Dashboard.jsx."""

import io
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

s = io.open('src/pages/Dashboard/Dashboard.jsx', encoding='utf-8').read()
for k, m in enumerate(re.finditer(r'<table className="db-inv">(.*?)</table>', s, re.S), 1):
    body = m.group(1)
    tbody = re.search(r'<tbody>(.*?)</tbody>', body, re.S)
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', tbody.group(1), re.S) if tbody else []
    print('== TABLE', k, 'rows:', len(rows))
    if rows:
        print(' '.join(rows[0].split())[:1000])
    print()
