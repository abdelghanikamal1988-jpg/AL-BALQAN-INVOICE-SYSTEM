# -*- coding: utf-8 -*-
"""Round-2 formatting unification: typography scale, radii, button heights,
table paddings, field rhythm, page rhythm, stacked-table 2-col grid."""
import io
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ROOT = ''

# (file, old, new, expected_count)
EDITS = [
    # ---------------- global.css ----------------
    ('src/styles/global.css',
     '.btn--sm {\n  padding: 5.5px 10px;\n  font-size: 12.5px;\n  border-radius: var(--radius-sm);\n}',
     '.btn--sm {\n  min-height: 32px;\n  padding: 7px 12px;\n  font-size: 13px;\n  border-radius: var(--radius-sm);\n}', 1),

    ('src/styles/global.css',
     '.icon-btn {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 28px;\n  height: 28px;',
     '.icon-btn {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 32px;\n  height: 32px;', 1),

    ('src/styles/global.css',
     '  gap: 4px;\n  height: 28px;\n  padding: 0 10px;\n  border: none;\n  border-radius: 4px;\n  background: var(--brand);\n  color: #fff;\n  font-size: 12px;\n  font-weight: 500;',
     '  gap: 4px;\n  height: 40px;\n  padding: 0 14px;\n  border: none;\n  border-radius: 8px;\n  background: var(--brand);\n  color: #fff;\n  font-size: 13px;\n  font-weight: 500;', 1),

    # 9.6px micro-grid -> 10px (bell/tool/user radius + user gap)
    ('src/styles/global.css', '9.6px', '10px', 5),

    ('src/styles/global.css',
     '.app-header__user {\n  display: inline-flex;\n  align-items: center;\n  gap: 10px;\n  height: 42px;\n  padding: 5px 10px;',
     '.app-header__user {\n  display: inline-flex;\n  align-items: center;\n  gap: 10px;\n  height: 40px;\n  padding: 4px 10px;', 1),

    ('src/styles/global.css',
     '.app-header__vr {\n  flex: 0 0 1px;\n  width: 1px;\n  height: 42px;',
     '.app-header__vr {\n  flex: 0 0 1px;\n  width: 1px;\n  height: 40px;', 1),

    ('src/styles/global.css',
     '.login-card .btn--primary {\n  background: var(--brand);\n  color: #fff;\n  min-height: 42px;\n  font-size: 14px;\n}',
     '.login-card .btn--primary {\n  background: var(--brand);\n  color: #fff;\n  min-height: 36px;\n  font-size: 14px;\n}', 1),

    ('src/styles/global.css',
     '.field {\n  display: flex;\n  flex-direction: column;\n  gap: 5px;\n}',
     '.field {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}', 1),

    ('src/styles/global.css',
     '.login-card .field {\n  gap: 8px;\n}',
     '.login-card .field {\n  gap: 6px;\n}', 1),

    ('src/styles/global.css',
     '.login-card .field label {\n  color: #e5e7eb;\n  font-size: 14px;\n  font-weight: 500;\n}',
     '.login-card .field label {\n  color: #e5e7eb;\n  font-size: 13px;\n  font-weight: 500;\n}', 1),

    ('src/styles/global.css',
     '  border-radius: 6px;\n  font-size: 11.5px;\n  font-weight: 600;\n  line-height: 1.4;',
     '  border-radius: 6px;\n  font-size: 11px;\n  font-weight: 600;\n  line-height: 1.4;', 1),

    ('src/styles/global.css',
     '  border-top: 1px solid var(--line-soft);\n  font-size: 11.5px;',
     '  border-top: 1px solid var(--line-soft);\n  font-size: 11px;', 1),

    ('src/styles/global.css',
     '.login-brand__tile span {\n  font-size: 11.5px;',
     '.login-brand__tile span {\n  font-size: 11px;', 1),

    ('src/styles/global.css',
     '.topsearch__footer kbd {\n  font-family: var(--font-mono);\n  font-size: 10.5px;',
     '.topsearch__footer kbd {\n  font-family: var(--font-mono);\n  font-size: 11px;', 1),

    ('src/styles/global.css',
     '.page-header h1 {\n  font-size: 24px;\n  font-weight: 700;\n  letter-spacing: -0.02em;\n  margin-bottom: 5px;\n}',
     '.page-header h1 {\n  font-size: 24px;\n  font-weight: 700;\n  letter-spacing: -0.02em;\n  margin-bottom: 6px;\n}', 1),

    ('src/styles/global.css',
     '  .page-header h1 {\n    font-size: 21px;\n  }',
     '  .page-header h1 {\n    font-size: var(--fs-title);\n  }', 1),

    # ---------------- invoice.css ----------------
    ('src/styles/invoice.css',
     '.history-table th {\n  text-align: start;\n  font-size: 11px;\n  text-transform: uppercase;\n  letter-spacing: 0.06em;\n  font-weight: 700;\n  color: var(--muted);\n  background: transparent;\n  padding: 10px 12px;',
     '.history-table th {\n  text-align: start;\n  font-size: 11px;\n  text-transform: uppercase;\n  letter-spacing: 0.06em;\n  font-weight: 700;\n  color: var(--muted);\n  background: transparent;\n  padding: 10px 16px;', 1),

    ('src/styles/invoice.css',
     '.history-table td {\n  padding: 11px 12px;',
     '.history-table td {\n  padding: 12px 16px;', 1),

    ('src/styles/invoice.css',
     '.history-table .mono {\n  font-family: var(--font-mono);\n  font-size: 12.5px;\n  color: var(--brand-strong);',
     '.history-table .mono {\n  font-family: var(--font-mono);\n  color: var(--brand-strong);', 1),

    ('src/styles/invoice.css',
     '.history-table .actions-cell .btn {\n  margin-inline-end: 4px;\n  padding: 7px 9px;\n  font-size: 12.5px;\n}',
     '.history-table .actions-cell .btn {\n  margin-inline-end: 4px;\n  min-height: 32px;\n  padding: 7px 12px;\n  font-size: 13px;\n}', 1),

    ('src/styles/invoice.css',
     '.history-filters__field label {\n  font-size: 10.5px;',
     '.history-filters__field label {\n  font-size: 11px;', 1),

    ('src/styles/invoice.css',
     '  min-height: 34px;\n  font-size: 13.5px;\n  padding: 7px 10px;',
     '  min-height: 40px;\n  font-size: 14px;\n  padding: 7px 10px;', 1),

    # ---------------- clients.css ----------------
    ('src/styles/clients.css',
     '.cl-table td {\n  padding: 11px 16px;',
     '.cl-table td {\n  padding: 12px 16px;', 1),

    ('src/styles/clients.css',
     '.clients-page .cl-table .btn--sm {\n  padding: 6px 11px;\n  font-size: 12.5px;\n}\n\n',
     '', 1),

    ('src/styles/clients.css',
     '  .clients-page .page-header h1 {\n    font-size: 21px;\n  }',
     '  .clients-page .page-header h1 {\n    font-size: var(--fs-title);\n  }', 1),

    ('src/styles/clients.css',
     '  font-size: 14.5px;\n}',
     '  font-size: 14px;\n}', 1),

    ('src/styles/clients.css',
     '.clients-page .cf-grid .field label {\n  font-size: 13px;\n  font-weight: 600;\n  letter-spacing: normal;\n  text-transform: none;\n  color: var(--text);\n  margin-bottom: -1px;\n}',
     '.clients-page .cf-grid .field label {\n  font-size: 13px;\n  font-weight: 600;\n  letter-spacing: normal;\n  text-transform: none;\n  color: var(--text);\n}', 1),

    ('src/styles/clients.css',
     '.cl-sub {\n  display: block;\n  font-size: 11.5px;',
     '.cl-sub {\n  display: block;\n  font-size: 11px;', 1),

    ('src/styles/clients.css',
     '.cf-doc__file {\n  font-size: 11.5px;',
     '.cf-doc__file {\n  font-size: 11px;', 1),

    ('src/styles/clients.css',
     '.cd-doc__name {\n  font-size: 11.5px;',
     '.cd-doc__name {\n  font-size: 11px;', 1),

    ('src/styles/clients.css',
     '.cf-doc__label {\n  display: inline-block;\n  font-size: 10px;',
     '.cf-doc__label {\n  display: inline-block;\n  font-size: 11px;', 1),

    ('src/styles/clients.css',
     '.cd-item__label {\n  font-size: 10px;',
     '.cd-item__label {\n  font-size: 11px;', 1),

    ('src/styles/clients.css',
     '.cl-modal-inv th {\n  font-size: 10.5px;',
     '.cl-modal-inv th {\n  font-size: 11px;', 1),

    # ---------------- dashboard.css ----------------
    ('src/styles/dashboard.css',
     '.db-act {\n  width: 100%;\n  border-collapse: collapse;\n  font-size: 14px;\n}',
     '.db-act {\n  width: 100%;\n  border-collapse: collapse;\n  font-size: 13.5px;\n}', 1),

    ('src/styles/dashboard.css',
     '.db-inv {\n  width: 100%;\n  border-collapse: collapse;\n  font-size: 14px;\n  min-width: 560px;\n}',
     '.db-inv {\n  width: 100%;\n  border-collapse: collapse;\n  font-size: 13.5px;\n  min-width: 560px;\n}', 1),

    ('src/styles/dashboard.css',
     '  padding: 8px 18px;\n  border-bottom: 1px solid var(--border);\n  white-space: nowrap;\n}',
     '  padding: 10px 16px;\n  border-bottom: 1px solid var(--border);\n  white-space: nowrap;\n}', 2),

    ('src/styles/dashboard.css',
     '.db-act td {\n  padding: 12px 18px;',
     '.db-act td {\n  padding: 12px 16px;', 1),

    ('src/styles/dashboard.css',
     '.db-inv td {\n  padding: 12px 18px;',
     '.db-inv td {\n  padding: 12px 16px;', 1),

    ('src/styles/dashboard.css',
     '.db-inv tfoot td {\n  background: var(--ground);\n  border-top: 1px solid var(--border);\n  border-bottom: none;\n  font-size: 13px;',
     '.db-inv tfoot td {\n  background: var(--ground);\n  border-top: 1px solid var(--border);\n  border-bottom: none;\n  font-size: 13.5px;', 1),

    # <=768 media: drop local table paddings (unified base wins)
    ('src/styles/dashboard.css',
     '  .db-act th,\n  .db-act td {\n    padding: 10px 12px;\n  }\n\n  .db-inv th,\n  .db-inv td {\n    padding: 10px 12px;\n  }\n\n',
     '', 1),

    ('src/styles/dashboard.css',
     '  .db-hero h1 {\n    font-size: 21px;\n  }',
     '  .db-hero h1 {\n    font-size: 20px;\n  }', 1),

    ('src/styles/dashboard.css',
     '  .db-hero__actions {\n    margin-top: 14px;\n  }',
     '  .db-hero__actions {\n    margin-top: 16px;\n  }', 1),

    ('src/styles/dashboard.css',
     '  .db-metrics {\n    grid-template-columns: repeat(2, 1fr);\n    gap: 10px;\n  }',
     '  .db-metrics {\n    grid-template-columns: repeat(2, 1fr);\n    gap: 12px;\n  }', 1),

    ('src/styles/dashboard.css',
     '  .db-status__name {\n    width: 110px;\n    font-size: 11.5px;\n  }',
     '  .db-status__name {\n    width: 110px;\n    font-size: 11px;\n  }', 1),

    ('src/styles/dashboard.css',
     '.db-act__type {\n  display: inline-block;\n  font-size: 10.5px;',
     '.db-act__type {\n  display: inline-block;\n  font-size: 11px;', 1),

    ('src/styles/dashboard.css',
     '.db-utility__note {\n  margin-inline-end: auto;\n  font-size: 12.5px;',
     '.db-utility__note {\n  margin-inline-end: auto;\n  font-size: 12px;', 1),

    ('src/styles/dashboard.css', 'gap: 14px;', 'gap: 16px;', 4),
    ('src/styles/dashboard.css', 'margin-bottom: 14px;', 'margin-bottom: 16px;', 2),

    # ---------------- admin.css ----------------
    ('src/styles/admin.css',
     '  .au-table thead {\n    display: none;\n  }\n\n  .au-table td {\n    display: flex;\n    justify-content: space-between;\n    gap: 12px;\n    border: none;\n    padding: 5px 16px;\n  }\n\n',
     '', 1),

    ('src/styles/admin.css',
     '.au-modal .modal__header {\n  padding: 14px 22px;\n}',
     '.au-modal .modal__header {\n  padding: 14px 20px;\n}', 1),

    ('src/styles/admin.css',
     '.au-modal .modal__body {\n  padding: 16px 22px;',
     '.au-modal .modal__body {\n  padding: 16px 20px;', 1),

    ('src/styles/admin.css',
     '.au-modal .modal__actions {\n  padding: 12px 22px 16px;\n}',
     '.au-modal .modal__actions {\n  padding: 12px 20px 16px;\n}', 1),

    ('src/styles/admin.css',
     '  color: var(--muted);\n  background: transparent;\n  padding: 10px 20px;',
     '  color: var(--muted);\n  background: transparent;\n  padding: 10px 16px;', 1),

    ('src/styles/admin.css',
     '.au-table td {\n  padding: 11px 20px;',
     '.au-table td {\n  padding: 12px 16px;', 1),

    # ---------------- sidebar.css ----------------
    ('src/styles/sidebar.css',
     '.sidebar__brand-logo span {\n  font-size: 11.5px;',
     '.sidebar__brand-logo span {\n  font-size: 11px;', 1),

    ('src/styles/sidebar.css',
     '.sidebar__brand-name {\n  font-size: 14.5px;',
     '.sidebar__brand-name {\n  font-size: 14px;', 1),

    ('src/styles/sidebar.css',
     '.sidebar__group {\n  padding: 14px 10px 5px;\n  font-size: 10px;',
     '.sidebar__group {\n  padding: 14px 10px 5px;\n  font-size: 11px;', 1),

    # ---------------- responsive.css ----------------
    ('src/styles/responsive.css',
     '  .page {\n    padding: 16px 14px calc(30px + env(safe-area-inset-bottom));\n  }',
     '  .page {\n    padding: 16px 16px calc(30px + env(safe-area-inset-bottom));\n  }', 1),

    ('src/styles/responsive.css',
     'minmax(150px, 1fr));\n    gap: 10px;',
     'minmax(150px, 1fr));\n    gap: 12px;', 2),

    ('src/styles/responsive.css',
     '  .history-filters {\n    gap: 10px;\n  }',
     '  .history-filters {\n    gap: 8px;\n  }', 1),

    ('src/styles/responsive.css', 'padding: 13px 14px;', 'padding: 14px 16px;', 3),

    ('src/styles/responsive.css',
     '    min-height: var(--tap-min);\n    padding: 0 8px;\n    margin: 0;\n  }',
     '    min-height: var(--tap-min);\n    padding: 0 8px;\n    margin-block: -12px;\n  }', 2),

    ('src/styles/responsive.css',
     '  .pending-chip {\n    min-height: var(--tap-min);\n    padding: 10px 14px;\n  }',
     '  .pending-chip {\n    min-height: var(--tap-min);\n    padding: 10px 14px;\n    margin-block: -8px;\n  }', 2),

    # stacked rows -> 2-column grid (halves row height)
    ('src/styles/responsive.css',
     '    display: block;\n    margin: 0 0 10px;\n    padding: 2px 0;',
     '    display: grid;\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n    margin: 0 0 10px;\n    padding: 2px 0;', 1),

    ('src/styles/responsive.css',
     '    gap: 14px;\n    padding: 8px 13px;',
     '    gap: 4px 8px;\n    padding: 7px 10px;', 1),

    ('src/styles/responsive.css',
     '    font-size: 10.5px;\n    font-weight: 700;\n    line-height: 1.5;',
     '    font-size: 11px;\n    font-weight: 700;\n    line-height: 1.5;', 1),

    # full-width action cells + full-width tfoot caption
    ('src/styles/responsive.css',
     '  .history-table td[data-label],\n  .cl-table td[data-label],\n  .db-inv td[data-label],\n  .au-table td[data-label] {\n    align-items: center;\n  }',
     '  .history-table td[data-label],\n  .cl-table td[data-label],\n  .db-inv td[data-label],\n  .au-table td[data-label] {\n    align-items: center;\n  }\n\n'
     '  .history-table td.actions-cell,\n  .cl-table td.actions-cell,\n  .au-table td.au-actions,\n  .history-table tfoot td:first-child,\n  .cl-table tfoot td:first-child,\n  .db-inv tfoot td:first-child,\n  .au-table tfoot td:first-child {\n    grid-column: 1 / -1;\n  }\n\n'
     '  .history-table td.actions-cell::before,\n  .cl-table td.actions-cell::before,\n  .au-table td.au-actions::before {\n    margin-inline-end: auto;\n  }', 1),

    ('src/styles/responsive.css',
     'padding: 11px 12px;',
     'padding: 12px;', 1),

    ('src/styles/responsive.css',
     'padding: 11px 10px',
     'padding: 12px 10px', 1),

    # ---------------- audit: stacked detection accepts grid ----------------
    ('.dev/audit_mobile_v2.py',
     "const stacked = firstTr ? getComputedStyle(firstTr).display === 'block' : false;",
     "const stacked = firstTr ? ['block', 'grid'].includes(getComputedStyle(firstTr).display) : false;", 1),
]


def main():
    apply = '--apply' in sys.argv
    data = {}
    errs = []
    for f, old, new, want in EDITS:
        if f not in data:
            data[f] = io.open(f, encoding='utf-8').read()
        n = data[f].count(old)
        if n != want:
            errs.append('%s: found %d want %d :: %r' % (f, n, want, old[:90]))
            continue
        data[f] = data[f].replace(old, new)
    if errs:
        print('COUNT MISMATCH (%d):' % len(errs))
        for e in errs:
            print(' -', e)
        return 1
    if not apply:
        print('DRY OK: all %d edits match counts.' % len(EDITS))
        return 0
    for f, s in data.items():
        io.open(f, 'w', encoding='utf-8', newline='\n').write(s)
        print('written', f)
    return 0


if __name__ == '__main__':
    sys.exit(main())
