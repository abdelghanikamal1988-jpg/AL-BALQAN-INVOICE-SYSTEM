"""Table classes in Dashboard + tail of history row (actions td)."""

import io
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

s = io.open('src/pages/Dashboard/Dashboard.jsx', encoding='utf-8').read()
print('db-inv tables:', len(re.findall(r'<table className="db-inv"', s)))
print('db-act tables:', len(re.findall(r'<table[^>]*db-act', s)))
print('all tables:', re.findall(r'<table[^>]*>', s))

# order of tables and their first tbody cell
for m in re.finditer(r'<table className="([^"]*)">(.*?)</table>', s, re.S):
    cls = m.group(1)
    body = m.group(2)
    first_td = re.search(r'<td[^>]*>', body)
    n_th = len(re.findall(r'<th', body.split('<tbody')[0]))
    n_td_row = len(re.findall(r'<td', (re.search(r'<tr[^>]*>(.*?)</tr>', body.split('<tbody')[-1], re.S).group(1) if '<tbody' in body else '')))
    print(' table cls=%s ths=%d tds/row=%d first=%s' % (cls, n_th, n_td_row, first_td.group(0) if first_td else None))

h = io.open('src/pages/InvoiceHistory/InvoiceHistory.jsx', encoding='utf-8').read()
i = h.find('pending-chip--rejected')
print()
print('HISTORY after rejected:', ' '.join(h[i:i + 1600].split())[:1200])
