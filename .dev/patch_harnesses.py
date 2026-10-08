"""Patch the static preview harnesses so they mirror the app markup:

1. viewport meta gains viewport-fit=cover.
2. Stacked tables (history-table / cl-table / db-inv / au-table) get
   data-label on every <td>, copied from the <th> text of that table.
3. Filters toggle buttons are inserted before .cl-toolbar / .history-filters
   (expanded state — no is-collapsed — so audits measure the worst case).
4. InvoiceHistory harness gets the .load-more block after the table wrap.
5. Every .modal__header gains the .modal__close button.
Idempotent: re-running skips what is already done.
"""

import glob
import io
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

STACKED = ('history-table', 'cl-table', 'db-inv', 'au-table')

TOGGLE = (
    '<button type="button" class="btn btn--neutral filters-toggle" '
    'aria-expanded="true">Filters &#9662;</button>'
)

LOAD_MORE = (
    '<div class="load-more">'
    '<button type="button" class="btn btn--neutral">Load more (128)</button>'
    '</div>'
)

CLOSE_BTN = (
    '<button type="button" class="modal__close" aria-label="Close">&times;</button>'
)


def th_texts(table_html):
    thead = re.search(r'<thead>(.*?)</thead>', table_html, re.S)
    if not thead:
        return []
    row = re.search(r'<tr[^>]*>(.*?)</tr>', thead.group(1), re.S)
    if not row:
        return []
    cells = re.findall(r'<th\b[^>]*?(?:/>|>(.*?)</th>)', row.group(1), re.S)
    texts = []
    for c in cells:
        txt = c or ''
        txt = re.sub(r'<[^>]+>', '', txt)
        txt = txt.replace('&nbsp;', ' ').strip()
        texts.append(txt)
    # self-closing <th aria-label="…"/> cells carry no text — pull the attr
    for i, cell_tag in enumerate(re.findall(r'<th\b[^>]*>', row.group(1))):
        if i < len(texts) and not texts[i]:
            am = re.search(r'aria-label="([^"]+)"', cell_tag)
            if am:
                texts[i] = am.group(1).strip()
    return texts


def patch_table(html, cls):
    """Add data-label to <td>s of every row (keys reset per <tr>)."""
    added = 0
    # iterate in reverse so earlier offsets stay valid while html mutates
    for m in reversed(list(re.finditer(r'<table class="%s"[^>]*>' % cls, html))):
        start = m.start()
        end = html.find('</table>', start)
        if end < 0:
            continue
        block = html[start:end]
        keys = th_texts(block)
        if not keys:
            continue
        tbody = re.search(r'<tbody>(.*?)</tbody>', block, re.S)
        if not tbody:
            continue
        body = tbody.group(1)

        def fix_row(rm):
            row = rm.group(0)
            idx = [0]

            def add(mm):
                tag = mm.group(0)
                i = idx[0]
                idx[0] += 1
                if 'data-label=' in tag:
                    return tag
                if i >= len(keys):
                    return tag
                key = keys[i]
                if not key:
                    return tag
                inner = tag[3:-1]
                esc = key.replace('"', '')
                if inner.strip():
                    return '<td%s data-label="%s">' % (inner.rstrip(), esc)
                return '<td data-label="%s">' % esc

            return re.sub(r'<td[^>]*>', add, row)

        before = body.count('data-label=')
        new_body = re.sub(r'<tr[^>]*>.*?</tr>', fix_row, body, flags=re.S)
        added += new_body.count('data-label=') - before
        # totals rows live in <tfoot> — same column keys
        tm = re.search(r'<tfoot>(.*?)</tfoot>', block, re.S)
        if tm:
            tfoot = tm.group(1)
            before = tfoot.count('data-label=')
            new_foot = re.sub(r'<tr[^>]*>.*?</tr>', fix_row, tfoot, flags=re.S)
            added += new_foot.count('data-label=') - before
            block = block.replace(tfoot, new_foot, 1)
        html = html[:start] + block.replace(body, new_body, 1) + html[end:]
    return html, added


def patch_file(path):
    s = io.open(path, encoding='utf-8').read()
    orig = s
    notes = []

    # 1. viewport
    if 'viewport-fit' not in s:
        s2 = re.sub(
            r'(<meta name="viewport" content="[^"]*)(")',
            r'\1, viewport-fit=cover\2',
            s,
            count=1,
        )
        if s2 != s:
            s = s2
            notes.append('viewport')

    # 2. stacked-table labels
    total = 0
    for cls in STACKED:
        s, n = patch_table(s, cls)
        total += n
    if total:
        notes.append('data-label x%d' % total)

    # 3. filter toggles
    if 'filters-toggle' not in s:
        if 'cl-toolbar' in s:
            s = s.replace('<div class="cl-toolbar">', TOGGLE + '\n      <div class="cl-toolbar">', 1)
            notes.append('toggle(cl)')
        if 'history-filters' in s:
            s = s.replace('<div class="history-filters"', TOGGLE + '\n      <div class="history-filters"', 1)
            notes.append('toggle(hist)')

    # 4. load-more after the history table wrap
    if 'history-table-wrap' in s and 'load-more' not in s:
        s = re.sub(
            r'(<div class="history-table-wrap">[\s\S]*?</table>\s*</div>)',
            r'\1\n          ' + LOAD_MORE,
            s,
            count=1,
        )
        notes.append('load-more')

    # 5. modal close buttons
    if 'modal__header' in s and 'modal__close' not in s:
        n = s.count('<div class="modal__header">')
        s = s.replace(
            '<div class="modal__header">',
            '<div class="modal__header">' + CLOSE_BTN,
        )
        notes.append('close x%d' % n)

    if s != orig:
        io.open(path, 'w', encoding='utf-8', newline='').write(s)
    return notes


def main():
    files = sorted(glob.glob('.dev/preview-*.html'))
    for f in files:
        notes = patch_file(f)
        print('%-34s %s' % (f.split('\\')[-1].split('/')[-1], ', '.join(notes) if notes else 'no change'))


if __name__ == '__main__':
    main()
