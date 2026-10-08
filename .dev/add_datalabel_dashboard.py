"""Insert data-label attributes into Dashboard.jsx db-inv tables.

For each <table className="db-inv">: read the t('…') keys from the
thead, then append data-label={t('key')} to every <td> of the tbody
row template (skipping tds that already have data-label).
"""

import io
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

PATH = 'src/pages/Dashboard/Dashboard.jsx'
s = io.open(PATH, encoding='utf-8').read()

out = []
pos = 0
count = 0

for m in re.finditer(r'<table className="db-inv">', s):
    start = m.start()
    end = s.find('</table>', start)
    block = s[start:end]
    thead = re.search(r'<thead>(.*?)</thead>', block, re.S)
    keys = re.findall(r"t\('([^']+)'\)", thead.group(1)) if thead else []
    tbody = re.search(r'<tbody>(.*?)</tbody>', block, re.S)
    if not keys or not tbody:
        print('SKIP table: keys=%d tbody=%s' % (len(keys), bool(tbody)))
        continue
    body = tbody.group(1)
    # only the first (template) row
    tr = re.search(r'<tr[^>]*>(.*?)</tr>', body, re.S)
    row = tr.group(1)
    new_row = row
    idx = 0

    def add_label(mm):
        global idx, count
        tag = mm.group(0)
        if 'data-label' in tag or idx >= len(keys):
            return tag
        key = keys[idx]
        idx += 1
        count += 1
        if tag.endswith('/>'):
            return tag
        # <td ...>  -> insert before the closing '>'
        inner = tag[3:-1]  # between '<td' and '>'
        if inner.strip():
            return '<td' + inner.rstrip() + ' data-label={t(\'%s\')}>' % key
        return '<td data-label={t(\'%s\')}>' % key

    new_row = re.sub(r'<td[^>]*>', add_label, row)
    new_block = block.replace(row, new_row, 1)
    out.append(s[pos:start])
    out.append(new_block)
    pos = end
    print('table: keys=%s tds_labelled=%d' % (keys, idx))
    if idx != len(keys):
        print('  WARNING: td count %d != th count %d' % (idx, len(keys)))

out.append(s[pos:])
s2 = ''.join(out)
io.open(PATH, 'w', encoding='utf-8', newline='').write(s2)
print('total labels added:', count)
