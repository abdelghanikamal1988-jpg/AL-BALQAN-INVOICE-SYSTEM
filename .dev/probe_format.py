"""Formatting/consistency probe (round 2).

Measures visual rhythm across harnesses at 390 (phone) and 1024 (desktop):
  · border-radius histogram (visible elements)
  · font-size histogram of leaf text nodes
  · card paddings/radii for the card zoo
  · button heights per variant
  · section-head/title sizes and page-header rhythm
  · form field rhythm (label size, input height, stack gap)
  · table cell padding
  · gaps of main grids
  · page children spacing (vertical rhythm)
"""

import json
import sys
import time
import urllib.request

import websocket

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

PORT = 9333
BASE = ('file:///C:/Users/hp/OneDrive/Desktop/desktop%20298/'
        'AL%20BALQAN%20Invoice%20system/.dev/')

PAGES = [
    'preview-shell.html', 'preview-dashboard.html', 'preview-clients.html',
    'preview-history.html', 'preview-admin.html', 'preview-inbox.html',
    'preview-form.html', 'preview-login.html',
]
WIDTHS = [390, 1024]

JS = r"""
(() => {
  const out = {};
  const vis = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const hist = (arr) => {
    const m = {};
    for (const v of arr) m[v] = (m[v] || 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  };

  // 1. radius histogram
  const radii = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el)) continue;
    const s = getComputedStyle(el);
    for (const p of [s.borderTopLeftRadius, s.borderTopRightRadius]) {
      if (p && p !== '0px' && p !== '50%' && p !== '9999px' && p !== '999px') radii.push(p);
    }
  }
  out.radii = hist(radii).slice(0, 14);

  // 2. leaf text font sizes
  const fss = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el)) continue;
    if (el.children.length) continue;
    const t = (el.textContent || '').trim();
    if (!t) continue;
    fss.push(getComputedStyle(el).fontSize);
  }
  out.fontSizes = hist(fss).slice(0, 16);

  // 3. card zoo padding/radius
  const CARD_SEL = '.card, .db-section, .db-chart-card, .cl-card, .cd-card, .au-card, .login-card, .modal, .statc, .db-status, .cl-summary, .appr-row';
  out.cards = [];
  for (const el of document.querySelectorAll(CARD_SEL)) {
    if (!vis(el)) continue;
    const s = getComputedStyle(el);
    out.cards.push({t: el.className.split(' ').slice(0, 2).join('.'),
                    p: s.padding, r: s.borderTopLeftRadius});
  }

  // 4. button heights per variant
  const btns = {};
  for (const el of document.querySelectorAll('.btn, .btn--sm, .icon-btn, .btn--neutral, .btn--primary, .btn--danger, .app-header__cta, .btn--ghost')) {
    if (!vis(el)) continue;
    const key = el.className;
    const h = Math.round(el.getBoundingClientRect().height);
    (btns[key] = btns[key] || []).push(h);
  }
  out.btnHeights = {};
  for (const [k, v] of Object.entries(btns)) {
    const uniq = [...new Set(v)];
    out.btnHeights[k.slice(0, 60)] = uniq.length <= 3 ? uniq : hist(v.map(String)).slice(0, 4);
  }

  // 5. section heads + page header
  out.heads = [];
  for (const sel of ['.page-header h1', '.db-section__head', '.db-section__head h2', '.db-section__title', '.modal__header', '.login-card h1', '.login-card h2']) {
    const el = document.querySelector(sel);
    if (!el || !vis(el)) continue;
    const s = getComputedStyle(el);
    out.heads.push({t: sel, fs: s.fontSize, fw: s.fontWeight, h: Math.round(el.getBoundingClientRect().height), p: s.padding, mb: s.marginBottom});
  }

  // 6. form field rhythm
  const f = document.querySelector('.field');
  if (f) {
    const lab = f.querySelector('label');
    const inp = f.querySelector('input, select, textarea');
    out.field = {
      p: getComputedStyle(f).padding,
      gap: getComputedStyle(f).gap,
      mb: getComputedStyle(f).marginBottom,
      labelFs: lab ? getComputedStyle(lab).fontSize : null,
      labelMb: lab ? getComputedStyle(lab).marginBottom : null,
      inputH: inp ? Math.round(inp.getBoundingClientRect().height) : null,
      inputRadius: inp ? getComputedStyle(inp).borderRadius : null,
      inputFs: inp ? getComputedStyle(inp).fontSize : null,
    };
  }

  // 7. table cell padding (first table)
  const t = document.querySelector('table');
  if (t && vis(t)) {
    const th = t.querySelector('th');
    const td = t.querySelector('tbody td');
    out.table = {
      thPad: th ? getComputedStyle(th).padding : null,
      tdPad: td ? getComputedStyle(td).padding : null,
      tdFs: td ? getComputedStyle(td).fontSize : null,
      trH: td && td.parentElement ? Math.round(td.parentElement.getBoundingClientRect().height) : null,
    };
  }

  // 8. main grid gaps
  out.grids = [];
  for (const sel of ['.db-grid', '.db-charts', '.statc-row', '.form-grid', '.cl-toolbar', '.history-filters', '.editor-layout', '.page']) {
    const el = document.querySelector(sel);
    if (!el || !vis(el)) continue;
    const s = getComputedStyle(el);
    out.grids.push({t: sel, gap: s.gap, pad: s.padding});
  }

  // 9. vertical rhythm: gap between top-level children of .page
  const page = document.querySelector('.page');
  if (page) {
    const kids = [...page.children].filter(vis);
    const gaps = [];
    for (let i = 1; i < kids.length; i++) {
      const a = kids[i - 1].getBoundingClientRect();
      const b = kids[i].getBoundingClientRect();
      gaps.push({above: kids[i - 1].className.split(' ')[0] || kids[i - 1].tagName,
                 gap: Math.round(b.top - a.bottom)});
    }
    out.pageGaps = gaps.slice(0, 10);
  }

  return JSON.stringify(out);
})()
"""


def get_ws():
    req = urllib.request.Request(f'http://127.0.0.1:{PORT}/json')
    with urllib.request.urlopen(req, timeout=5) as r:
        ts = json.load(r)
    t = next((x for x in ts if x['type'] == 'page'), ts[0])
    return websocket.create_connection(t['webSocketDebuggerUrl'], timeout=30)


def run():
    ws = get_ws()
    mid = [0]

    def send(method, params=None):
        mid[0] += 1
        ws.send(json.dumps({'id': mid[0], 'method': method, 'params': params or {}}))
        while True:
            msg = json.loads(ws.recv())
            if msg.get('id') == mid[0]:
                return msg

    send('Page.enable')
    agg = {'radii': {}, 'fontSizes': {}, 'btnHeights': {}, 'heads': {}}
    for page in PAGES:
        for w in WIDTHS:
            send('Emulation.setDeviceMetricsOverride',
                 {'width': w, 'height': 844, 'deviceScaleFactor': 1, 'mobile': w < 500})
            send('Page.navigate', {'url': BASE + page})
            time.sleep(1.1)
            r = send('Runtime.evaluate', {'expression': JS, 'returnByValue': True})
            try:
                d = json.loads(r['result']['result']['value'])
            except Exception as e:
                print(f'EVALERR {page}@{w}: {e}')
                continue
            print(f'===== {page} @{w} =====')
            print('  radii    :', d.get('radii'))
            print('  fontSizes:', d.get('fontSizes'))
            print('  btnH     :', json.dumps(d.get('btnHeights'), ensure_ascii=False)[:400])
            print('  heads    :', json.dumps(d.get('heads'), ensure_ascii=False)[:500])
            print('  field    :', json.dumps(d.get('field'), ensure_ascii=False))
            print('  table    :', json.dumps(d.get('table'), ensure_ascii=False))
            print('  grids    :', json.dumps(d.get('grids'), ensure_ascii=False)[:500])
            print('  cards    :', json.dumps(d.get('cards'), ensure_ascii=False)[:500])
            print('  pageGaps :', json.dumps(d.get('pageGaps'), ensure_ascii=False)[:400])
            for k in ('radii', 'fontSizes'):
                for val, cnt in d.get(k) or []:
                    agg[k][val] = agg[k].get(val, 0) + cnt
    print('\n===== AGGREGATE (all pages x widths) =====')
    print('radii   :', sorted(agg['radii'].items(), key=lambda x: -x[1])[:16])
    print('fontSize:', sorted(agg['fontSizes'].items(), key=lambda x: -x[1])[:20])
    ws.close()


if __name__ == '__main__':
    run()
