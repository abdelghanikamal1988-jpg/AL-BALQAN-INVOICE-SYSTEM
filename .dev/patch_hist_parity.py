"""Bring the clients / invoice-history harness tables in line with the app:
add the missing User column, and wrap every tag-free cell value in a
.cell-v span so the stacked card rules can ellipsize it. Idempotent."""

import re

ROOT = (r'C:\Users\hp\OneDrive\Desktop\desktop 298\AL BALQAN Invoice system'
        r'\.dev')
FILES = ['preview-clients.html', 'preview-history.html', 'preview-hist-test.html',
         'preview-detail.html']

VALUE = re.compile(r'(<td\b[^>]*\bdata-label="[^"]*"[^>]*>)([^<>]+)(</td>)')
ACTIONS = re.compile(r'<td class="actions-cell"')
USER_TD = ('<td data-label="User"><div class="user-cell">'
           '<span>user@company.com</span></div></td>')

for name in FILES:
    path = ROOT + '\\' + name
    try:
        s = open(path, encoding='utf-8').read()
    except OSError:
        print('skip', name)
        continue
    orig = s

    # 1) User <th> before Actions
    if '<th>User</th>' not in s and '<th>Actions</th>' in s:
        s = s.replace('<th>Actions</th>', '<th>User</th>\n<th>Actions</th>')

    # 2) User cell right before every actions cell that does not have one
    add = [0]
    for m in list(ACTIONS.finditer(s))[::-1]:
        prev = s[s.rfind('<td', 0, m.start()):m.start()]
        if 'data-label="User"' in prev:
            continue
        line = s.rfind('\n', 0, m.start())
        s = s[:line + 1] + USER_TD + '\n' + s[line + 1:]
        add[0] += 1

    # 3) plain text values -> .cell-v
    n = [0]

    def wrap(m):
        n[0] += 1
        return '%s<span class="cell-v">%s</span>%s' % (m.group(1), m.group(2), m.group(3))

    s = VALUE.sub(wrap, s)
    print('%-24s changed=%s userCells=%d cell-v=%d' % (name, s != orig, add[0], n[0]))
    if s != orig:
        open(path, 'w', encoding='utf-8', newline='').write(s)
