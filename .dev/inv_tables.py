"""Inventory: table headers, filter/input markup, breadcrumb structure."""

import io
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

TABLES = [
    'src/pages/InvoiceHistory/InvoiceHistory.jsx',
    'src/pages/Clients/Clients.jsx',
    'src/pages/ClientDetail/ClientDetail.jsx',
    'src/pages/AdminUsers/AdminUsers.jsx',
    'src/pages/Dashboard/Dashboard.jsx',
    'src/components/PendingReview/PendingReviewModal.jsx',
]

for f in TABLES:
    s = io.open(f, encoding='utf-8').read()
    print('=====', f)
    for m in re.finditer(r'<table[^>]*className="([^"]+)"', s):
        seg = s[m.start():m.start() + 5000]
        ths = re.findall(r'<th[^>]*>(.*?)</th>', seg, re.S)
        print('  table:', m.group(1), '| cols:', len(ths))
        for t in ths[:14]:
            t2 = re.sub(r'\{t\(([^)]*)\)\}', r'[\1]', t)
            t2 = re.sub(r'<[^>]+>', '', t2).strip()[:34]
            print('    th:', t2)

print()
print('########## INPUTS / FILTERS ##########')
for f in ['src/pages/Clients/Clients.jsx', 'src/pages/Login/Login.jsx',
          'src/pages/InvoiceHistory/InvoiceHistory.jsx',
          'src/pages/ClientForm/ClientForm.jsx',
          'src/components/SearchBar/SearchBar.jsx']:
    s = io.open(f, encoding='utf-8').read()
    print('=====', f)
    for pat in [r'<input[^>]*>', r'<select[^>]*>']:
        for m in list(re.finditer(pat, s))[:8]:
            print('  ', m.group(0)[:190])

print()
print('########## BREADCRUMBS ##########')
for f in glob_src if (glob_src := []) else []:
    pass
import glob
for f in glob.glob('src/**/*.jsx', recursive=True):
    s = io.open(f, encoding='utf-8').read()
    if 'crumb' in s.lower() or 'Home</' in s:
        for m in re.finditer(r'.{60}(?:crumb|Home</).{80}', s, re.I | re.S):
            print(f, '::', ' '.join(m.group(0).split())[:170])
