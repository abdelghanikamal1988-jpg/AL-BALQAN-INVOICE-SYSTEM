"""Inventory part 3: pagination existence, form footer, wrappers, filter markup."""

import io
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')


def seg(f, pats, before=80, after=200, maxhits=3):
    s = io.open(f, encoding='utf-8').read()
    print('=====', f)
    for p in pats:
        hits = list(re.finditer(p, s))[:maxhits]
        if not hits:
            print('  [%s] NOT FOUND' % p)
        for m in hits:
            i = m.start()
            print('  [%s] %s' % (p[:28], ' '.join(s[max(0, i - before):i + after].split())[:230]))


seg('src/pages/Clients/Clients.jsx', [r'\.slice\(', r'loadMore', r'visible\.', r'showing'])
print()
seg('src/pages/ClientForm/ClientForm.jsx', [
    r'className="[^"]*actions[^"]*"', r"key: 'phoneNumber'", r"key: 'phone'",
    r"key: 'email'", r"type: 'date'", r"type: 'tel'", r'form-actions',
], maxhits=4)
print()
seg('src/pages/AdminUsers/AdminUsers.jsx', [r'au-table-wrap|au-wrap|overflow'], maxhits=2)
print()
seg('src/styles/admin.css', [r'\.au-table[^{]*\{[^}]*\}'], before=0, after=260, maxhits=4)
print()
seg('src/pages/InvoiceHistory/InvoiceHistory.jsx', [
    r'history-toolbar', r'history-filters"', r'type="file"'],
    before=40, after=240, maxhits=2)
print()
seg('src/styles/dashboard.css', [r'\.db-table-wrap\s*\{'], before=0, after=220, maxhits=2)
seg('src/styles/dashboard.css', [r'\.db-bars__cols\s*\{'], before=0, after=220, maxhits=2)
print()
seg('src/pages/Dashboard/Dashboard.jsx', [r'db-section__hint'], before=60, after=140, maxhits=4)
