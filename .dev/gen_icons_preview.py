import re

src = open('src/components/Icons/Icon.jsx', encoding='utf-8').read()
body = src.split('const PATHS = {', 1)[1].split('\n};', 1)[0]
entries = re.findall(r'\n  (\w+): \((.*?)\n  \),', body, re.S)
icons = {}
for name, frag in entries:
    inner = frag.strip()
    inner = re.sub(r'^<>|</>$', '', inner, flags=re.S).strip()
    inner = re.sub(r'\s+', ' ', inner)
    icons[name] = inner
print('parsed:', sorted(icons))


def svg(name):
    return (
        '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        + icons[name]
        + '</svg>'
    )


cards = ''.join(
    '<div class="card" style="margin:0 0 14px"><div class="card__header">'
    '<span class="card__icon" aria-hidden="true">' + svg(n) + '</span><h2>' + t + '</h2>'
    '</div><div style="padding:10px 20px 16px;font-size:14px;color:#5a6472">Sample body</div></div>'
    for n, t in [
        ('user', 'Customer Information'),
        ('receipt', 'Invoice details'),
        ('plane', 'Service &amp; Travel'),
        ('card', 'Payment'),
        ('note', 'Notes &amp; Terms'),
        ('paperclip', 'Documents'),
        ('folder', 'Passport Details'),
        ('userCheck', 'Referral'),
    ]
)

html = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Preview — icon system</title>
  <link rel="stylesheet" href="../dist/assets/index-CwaURzL-.css" />
  <style>
    body { background: var(--background, #f5f6f8); margin: 0; padding: 24px; }
    .modal, .modal-overlay, .db-approval { animation: none !important; }
    .gallery { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
    .panel { background: #fff; border: 1px solid #e4e7ec; border-radius: 10px; padding: 16px 18px; }
    .panel h4 { margin: 0 0 12px; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #8b94a3; }
    .head-strip { display: flex; justify-content: flex-end; background: #1d355e; border-radius: 8px; padding: 10px 14px; }
    .search-wrap { position: relative; }
  </style>
</head>
<body>
  <div class="gallery">
    <div>
      <div class="panel"><h4>Header bell (admin)</h4>
        <div class="head-strip"><div class="app-header__right"><button type="button" class="app-header__bell">__BELL__<span class="app-header__bell-count" aria-hidden="true">3</span></button><span class="app-header__avatar">MA</span></div></div>
      </div>
      <div class="panel" style="margin-top:16px"><h4>Dashboard approval banner</h4>
        <div class="db-approval" role="status"><span class="db-approval__icon" aria-hidden="true">__CLOCK__</span><span class="db-approval__text"><strong>3 edits waiting for your approval</strong><span>Review pending changes from your team.</span></span><button type="button" class="btn btn--secondary btn--sm">Review</button></div>
      </div>
      <div class="panel" style="margin-top:16px"><h4>Search bar + toast close</h4>
        <label class="searchbar search-wrap"><span class="searchbar__icon" aria-hidden="true">__SEARCH__</span><input type="search" value="MOHAMED" placeholder="Search invoices..." /><button type="button" class="searchbar__clear" aria-label="Clear search">__X__</button></label>
        <div class="toast toast--success" style="margin-top:14px"><span class="toast__msg">Invoice saved successfully</span><button type="button" class="toast__close">__X__</button></div>
      </div>
      <div class="panel" style="margin-top:16px"><h4>No-access card</h4>
        <div class="card login-card" style="max-width:340px;margin:0 auto"><span class="card__icon" aria-hidden="true">__LOCK__</span><h1>No access yet</h1></div>
      </div>
    </div>
    <div>
      <div class="panel"><h4>Empty states</h4>
        <div class="empty-state" style="padding:14px"><div class="empty-state__icon" aria-hidden="true">__RECEIPT__</div><h3>No invoices yet</h3></div>
        <div class="empty-state" style="padding:14px"><div class="empty-state__icon" aria-hidden="true">__USERS__</div><h3>No clients yet</h3></div>
      </div>
      <div class="panel" style="margin-top:16px"><h4>Edited-by marker</h4>
        <div class="user-cell"><span>MOHAMED ESSAM</span><span class="user-cell__sub">__PENCIL__ hr@albalqan.com</span></div>
      </div>
      <div class="panel" style="margin-top:16px"><h4>Approvals inbox rows</h4>
        <div class="appr-list">
          <div class="appr-row"><span class="appr-row__icon">__RECEIPT__</span><span class="appr-row__info"><span class="appr-row__title">INV-2026-0010 — MOHAMED ESSAM</span><span class="appr-row__meta">Invoice edit · hr@albalqan.com · 10/3/2026</span></span><button type="button" class="btn btn--secondary btn--sm">Review</button></div>
          <div class="appr-row"><span class="appr-row__icon">__USER__</span><span class="appr-row__info"><span class="appr-row__title">AHMED KAMAL SALEM</span><span class="appr-row__meta">Client edit · hr@albalqan.com · 10/3/2026</span></span><button type="button" class="btn btn--secondary btn--sm">Review</button></div>
        </div>
      </div>
    </div>
  </div>
  <div style="margin-top:18px">__CARDS__</div>
</body>
</html>
"""

repl = {
    '__BELL__': svg('bell'),
    '__CLOCK__': svg('clock'),
    '__SEARCH__': svg('search'),
    '__X__': svg('x'),
    '__LOCK__': svg('lock'),
    '__RECEIPT__': svg('receipt'),
    '__USERS__': svg('users'),
    '__PENCIL__': svg('pencil'),
    '__USER__': svg('user'),
    '__CARDS__': cards,
}
for k, v in repl.items():
    html = html.replace(k, v)

open('.dev/preview-icons.html', 'w', encoding='utf-8').write(html)
print('written', len(html))
