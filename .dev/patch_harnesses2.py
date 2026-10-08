"""Second-pass harness fixes: missing User column + admin Actions label."""

import io
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

USER_TD = ('<td data-label="User"><div class="user-cell">'
           '<span>user@company.com</span></div></td>')

# preview-history: insert User before the actions-cell td
p = '.dev/preview-history.html'
s = io.open(p, encoding='utf-8').read()
if 'data-label="User"' not in s:
    s = s.replace('<td class="actions-cell" data-label="Actions">',
                  USER_TD + '\n                        <td class="actions-cell" data-label="Actions">', 1)
    io.open(p, 'w', encoding='utf-8', newline='').write(s)
    print('history: user td added')

# preview-clients: same
p = '.dev/preview-clients.html'
s = io.open(p, encoding='utf-8').read()
if 'data-label="User"' not in s:
    s = s.replace('<td class="actions-cell" data-label="Actions">',
                  USER_TD + '\n                        <td class="actions-cell" data-label="Actions">', 1)
    io.open(p, 'w', encoding='utf-8', newline='').write(s)
    print('clients: user td added')

# preview-admin: label the actions cell
p = '.dev/preview-admin.html'
s = io.open(p, encoding='utf-8').read()
if '<td class="au-actions">' in s:
    s = s.replace('<td class="au-actions">', '<td class="au-actions" data-label="Actions">', 1)
    io.open(p, 'w', encoding='utf-8', newline='').write(s)
    print('admin: actions labelled')

print('done')
