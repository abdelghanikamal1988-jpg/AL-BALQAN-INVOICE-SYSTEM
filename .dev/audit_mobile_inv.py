"""Mobile inventory audit: for every preview harness at 360/390px, detect
text overflowing cards, page-level horizontal scroll, unusable tables,
small touch targets and iOS-zoom inputs."""

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
    'preview-dashboard.html', 'preview-shell.html', 'preview-clients.html',
    'preview-detail.html', 'preview-form.html', 'preview-create.html',
    'preview-history.html', 'preview-admin.html', 'preview-inbox.html',
    'preview-pending.html', 'preview-gate.html', 'preview-header.html',
    'preview-login.html', 'preview-hist-test.html',
]
WIDTHS = [360, 390]

EVAL_JS = r"""
(() => {
  const vw = window.innerWidth;
  const out = {vw};
  out.pageScroll = Math.max(document.documentElement.scrollWidth,
                             document.body ? document.body.scrollWidth : 0) - vw;

  // ---- 1. text overflowing its own box (clipped or pushed out) ----
  const clipped = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') continue;
    if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 30) {
      const tag = el.tagName.toLowerCase();
      const cls = typeof el.className === 'string' && el.className
        ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
      clipped.push({t: tag + cls, cw: el.clientWidth, sw: el.scrollWidth,
                    txt: (el.textContent || '').trim().slice(0, 30)});
    }
  }
  out.clipped = clipped.slice(0, 14);

  // ---- 2. descendants sticking out of their card ----
  const CARDS = '.card, .db-chart-card, .statc, .cl-card, .cd-card, .db-section, .modal, .login-card, .appr-row, .empty-state, .toasts > *';
  const escapees = [];
  for (const card of document.querySelectorAll(CARDS)) {
    const ccs = getComputedStyle(card);
    if (ccs.display === 'none') continue;
    const cb = card.getBoundingClientRect();
    if (cb.width < 40) continue;
    for (const el of card.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
      const b = el.getBoundingClientRect();
      if (b.width < 4 || b.height < 4) continue;
      const over = Math.max(b.right - cb.right, cb.left - b.left);
      if (over > 3) {
        const cls = typeof el.className === 'string' && el.className
          ? '.' + el.className.trim().split(/\s+/)[0] : el.tagName;
        escapees.push({card: (typeof card.className === 'string' ? card.className.split(' ')[0] : 'card'),
                       el: cls, over: Math.round(over),
                       txt: (el.textContent || '').trim().slice(0, 26)});
      }
    }
  }
  escapees.sort((a, b) => b.over - a.over);
  out.escapees = escapees.slice(0, 10);

  // ---- 3. tables: is there a mobile strategy? ----
  out.tables = [];
  for (const t of document.querySelectorAll('table')) {
    const cs = getComputedStyle(t);
    if (cs.display === 'none') continue;
    let p = t.parentElement, scrollable = false, hiddenCols = false;
    while (p && p !== document.body) {
      const ps = getComputedStyle(p);
      if (ps.overflowX === 'auto' || ps.overflowX === 'scroll') { scrollable = true; break; }
      p = p.parentElement;
    }
    const stacked = t.querySelector('td[data-label]') !== null;
    const wrapCls = t.parentElement && typeof t.parentElement.className === 'string'
      ? t.parentElement.className.split(' ')[0] : '';
    out.tables.push({cls: (typeof t.className === 'string' ? t.className : '') || '(none)',
                     w: Math.round(t.getBoundingClientRect().width),
                     cols: t.querySelectorAll('thead th, tr:first-child th, tr:first-child td').length,
                     rows: t.querySelectorAll('tbody tr').length,
                     scrollable, stacked, wrap: wrapCls});
  }

  // ---- 4. touch targets ----
  const small = [];
  const sel = 'a, button, [role="button"], input:not([type=checkbox]):not([type=radio]), select, textarea, [onclick]';
  for (const el of document.querySelectorAll(sel)) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const b = el.getBoundingClientRect();
    if (b.width < 4 || b.height < 4) continue;
    if (b.height < 40 || b.width < 40) {
      const cls = typeof el.className === 'string' && el.className
        ? '.' + el.className.trim().split(/\s+/)[0] : el.tagName;
      small.push({t: cls, w: Math.round(b.width), h: Math.round(b.height),
                  txt: (el.textContent || el.value || '').trim().slice(0, 20)});
    }
  }
  out.small = small.slice(0, 14);

  // ---- 5. inputs smaller than 16px (iOS zoom) ----
  const zoomy = [];
  for (const el of document.querySelectorAll('input, select, textarea')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none') continue;
    const fs = parseFloat(cs.fontSize);
    if (fs < 16) zoomy.push({t: el.type || el.tagName, fs});
  }
  out.zoomInputs = zoomy.slice(0, 8);
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
    total = {'clipped': 0, 'escapees': 0, 'small': 0, 'zoom': 0, 'pageScroll': 0, 'tables': 0}
    for page in PAGES:
        for w in WIDTHS:
            send('Emulation.setDeviceMetricsOverride',
                 {'width': w, 'height': 844, 'deviceScaleFactor': 1, 'mobile': w < 500})
            send('Page.navigate', {'url': BASE + page})
            time.sleep(1.4)
            r = send('Runtime.evaluate', {'expression': EVAL_JS, 'returnByValue': True})
            try:
                d = json.loads(r['result']['result']['value'])
            except Exception as e:
                print(f'EVALERR {page} {w}: {e}')
                continue
            probs = []
            if d['pageScroll'] > 1:
                probs.append(f"PAGE-SCROLL +{d['pageScroll']}px")
                total['pageScroll'] += 1
            if d['clipped']:
                probs.append(f"CLIPPED {d['clipped'][:4]}")
                total['clipped'] += len(d['clipped'])
            if d['escapees']:
                probs.append(f"ESCAPE {d['escapees'][:4]}")
                total['escapees'] += len(d['escapees'])
            if d['small']:
                probs.append(f"SMALL {d['small'][:5]}")
                total['small'] += len(d['small'])
            if d['zoomInputs']:
                probs.append(f"ZOOM {d['zoomInputs'][:3]}")
                total['zoom'] += len(d['zoomInputs'])
            for t in d['tables']:
                total['tables'] += 1
                if not t['scrollable'] and not t['stacked'] and t['w'] > w - 20:
                    probs.append(f"TABLE-UNUSABLE {t}")
            status = 'OK  ' if not probs else 'FAIL'
            print(f'{status} {page} @{w} ' + ('; '.join(probs) if probs else ''))
    print('\n=== totals ===', json.dumps(total))
    ws.close()


if __name__ == '__main__':
    run()
