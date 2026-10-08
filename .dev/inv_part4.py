"""Inventory part 4: AdminUsers table container, InvoiceHistory pagination, ClientForm fields."""

import io
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# 1) AdminUsers table container
s = io.open('src/pages/AdminUsers/AdminUsers.jsx', encoding='utf-8').read()
i = s.find('<table')
print('===== AdminUsers table markup:')
print(' '.join(s[max(0, i - 300):i + 60].split()))
print('au-table classes:', re.findall(r'className="[^"]*au-[^"]*"', s)[:12])

sa = io.open('src/styles/admin.css', encoding='utf-8').read()
for m in re.finditer(r'\.au-(card|table-wrap|scroll)\s*\{[^}]*\}', sa):
    print('css:', m.group(0)[:200])

# 2) InvoiceHistory pagination?
s2 = io.open('src/pages/InvoiceHistory/InvoiceHistory.jsx', encoding='utf-8').read()
print('\n===== InvoiceHistory:')
for p in [r'const visible', r'\.slice\(', r'showing', r'page', r'LIMIT', r'setShown']:
    hits = list(re.finditer(p, s2))[:3]
    print(' [%s] %s' % (p, len(hits)))
    for m in hits:
        i = m.start()
        print('    ', ' '.join(s2[max(0, i - 90):i + 170].split())[:240])

# 3) ClientForm full field list
s3 = io.open('src/pages/ClientForm/ClientForm.jsx', encoding='utf-8').read()
print('\n===== ClientForm FIELDS keys/types:')
print(re.findall(r"key:\s*'([^']+)',\s*label:\s*'([^']+)',\s*type:\s*'([^']+)'", s3))
i = s3.find('editor-actions')
print('\n===== editor-actions block:')
print(' '.join(s3[i - 40:i + 420].split()))
