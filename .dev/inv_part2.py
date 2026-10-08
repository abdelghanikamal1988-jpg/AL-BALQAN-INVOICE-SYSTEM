"""Inventory part 2: form actions, field types, table row markup per page."""

import io
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')


def show(f, pats, span=(60, 160)):
    s = io.open(f, encoding='utf-8').read()
    print('=====', f)
    for p in pats:
        for m in list(re.finditer(p, s))[:4]:
            i = m.start()
            print('  [%s] %s' % (p[:24], ' '.join(s[max(0, i - span[0]):i + span[1]].split())[:200]))


show('src/pages/ClientForm/ClientForm.jsx', [
    r'type=\{field\.type\}', r"key: '", r'cf-actions', r'type="tel"', r'type="date"',
    r'type="email"', r'type="number"', r'inputMode', r'autoComplete',
])
print()
show('src/pages/ClientForm/ClientForm.jsx', [r'const FIELDS[\s\S]{0,100}'], (0, 900))
print()
show('src/pages/Clients/Clients.jsx', [
    r'cl-toolbar', r'<td', r'cl-filters',
])
print()
show('src/pages/AdminUsers/AdminUsers.jsx', [r'<td', r'au-modal', r'type="email"', r'type="password"'])
print()
show('src/pages/ClientDetail/ClientDetail.jsx', [r'<td', r'cd-profile__select'])
print()
show('src/components/PendingReview/PendingReviewModal.jsx', [r'<td'])
print()
show('src/pages/Dashboard/Dashboard.jsx', [r'db-inv\b', r'className="db-inv"'])
