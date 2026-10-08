import io
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

EDITS = [
    ('src/styles/clients.css',
     '.mono {\n  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n  font-size: 0.95em;\n}',
     '.mono {\n  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n}', 1),

    ('src/styles/invoice.css',
     '  padding: 10px;\n  margin-bottom: 14px;\n}\n\n.history-toolbar .history-toolbar__search',
     '  padding: 10px;\n  margin-bottom: 16px;\n}\n\n.history-toolbar .history-toolbar__search', 1),

    ('src/styles/invoice.css',
     '  padding: 10px;\n  margin-bottom: 14px;\n}\n\n.history-filters__field {',
     '  padding: 10px;\n  margin-bottom: 16px;\n}\n\n.history-filters__field {', 1),

    ('src/styles/clients.css',
     '.clients-page .statc-row {\n  margin-bottom: 14px;\n}',
     '.clients-page .statc-row {\n  margin-bottom: 16px;\n}', 1),

    ('src/styles/clients.css',
     '  padding: 10px;\n  margin-bottom: 14px;\n  gap: 8px;\n}',
     '  padding: 10px;\n  margin-bottom: 16px;\n  gap: 8px;\n}', 1),

    ('src/styles/clients.css',
     '.cd-profile__actions {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 10px;\n  margin-bottom: 14px;\n}',
     '.cd-profile__actions {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 10px;\n  margin-bottom: 16px;\n}', 1),

    ('src/styles/clients.css',
     '.clients-page .legend {\n  margin-top: 14px;',
     '.clients-page .legend {\n  margin-top: 16px;', 1),

    ('src/styles/responsive.css',
     '  .filters-toggle {\n    display: inline-flex;\n    width: 100%;\n    justify-content: space-between;\n    margin-bottom: 10px;\n  }',
     '  .filters-toggle {\n    display: inline-flex;\n    width: 100%;\n    justify-content: space-between;\n    margin-bottom: 12px;\n  }', 1),
]


def main():
    apply = '--apply' in sys.argv
    data, errs = {}, []
    for f, old, new, want in EDITS:
        if f not in data:
            data[f] = io.open(f, encoding='utf-8').read()
        n = data[f].count(old)
        if n != want:
            errs.append('%s: found %d want %d :: %r' % (f, n, want, old[:80]))
            continue
        data[f] = data[f].replace(old, new)
    if errs:
        print('MISMATCH:')
        for e in errs:
            print(' -', e)
        return 1
    if not apply:
        print('DRY OK (%d edits)' % len(EDITS))
        return 0
    for f, s in data.items():
        io.open(f, 'w', encoding='utf-8', newline='\n').write(s)
        print('written', f)
    return 0


if __name__ == '__main__':
    sys.exit(main())
