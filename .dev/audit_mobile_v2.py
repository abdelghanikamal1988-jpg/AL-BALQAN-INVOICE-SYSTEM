"""Mobile acceptance audit v2 (system-wide responsive round).

For every preview harness at 360/390/414/768/1024 (LTR) and 390 (RTL/AR):
  · page-level horizontal overflow (rect-based + scrollWidth)
  · header content overflow (.app-header__inner)
  · text clipped inside its own box (skips ellipsis/line-clamp/inputs
    and content reachable through a scrolling ancestor)
  · descendants escaping their card (skips content contained by a
    scroll/clip ancestor between element and card)
  · stacked tables: every td must carry data-label; usable geometry
  · scrolling tables: must have a scrollable ancestor
  · touch targets < 40px (exempt: chart bars, inline text links)
  · form controls with font-size < 16px (iOS zoom)
  · modal sheets must fit the viewport and show the close button
  · Filters toggle present & tappable on phone harnesses
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
    'preview-dashboard.html', 'preview-shell.html', 'preview-clients.html',
    'preview-detail.html', 'preview-form.html', 'preview-create.html',
    'preview-history.html', 'preview-admin.html', 'preview-inbox.html',
    'preview-pending.html', 'preview-gate.html', 'preview-header.html',
    'preview-login.html', 'preview-hist-test.html',
]
WIDTHS = [360, 390, 414, 768, 1024]
RTL_W = [390]

EVAL_JS = r"""
(() => {
  const vw = window.innerWidth;
  const out = {vw};

  const cls = (el) => {
    if (!el) return '?';
    const c = typeof el.className === 'string' && el.className
      ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
    return el.tagName.toLowerCase() + c;
  };
  const hasAncestor = (el, test, stop) => {
    let p = el.parentElement;
    while (p && p !== stop && p !== document.body) {
      if (test(getComputedStyle(p))) return true;
      p = p.parentElement;
    }
    return false;
  };
  const scrollsX = (cs) => cs.overflowX === 'auto' || cs.overflowX === 'scroll';

  // Ancestor pushed off-screen (closed drawer / animated sheet) — its
  // descendants are not page escapes even though their rects are negative.
  const offscreenAncestor = (el) => {
    let p = el.parentElement;
    while (p && p !== document.body) {
      const cs = getComputedStyle(p);
      if (cs.position === 'fixed' || cs.transform !== 'none') {
        const pb = p.getBoundingClientRect();
        if (pb.width > 0 && (pb.right < 0 || pb.left > window.innerWidth)) return true;
      }
      p = p.parentElement;
    }
    return false;
  };

  // ---- 0. viewport overflow (rect based: what actually gets clipped) ----
  out.rectOverflow = 0;
  out.worst = null;
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (cs.position === 'fixed') continue;
    const b = el.getBoundingClientRect();
    if (b.width < 4 || b.height < 4) continue;
    const over = Math.max(b.right - vw, -b.left);
    if (over > out.rectOverflow + 1) {
      // contained by an intermediate scroller? then it is not a page escape
      if (!hasAncestor(el, scrollsX) && !offscreenAncestor(el)) {
        out.rectOverflow = Math.round(over);
        out.worst = cls(el);
      }
    }
  }
  out.docScroll = Math.max(
    document.documentElement.scrollWidth,
    document.body ? document.body.scrollWidth : 0) - vw;

  // ---- header fit ----
  const hi = document.querySelector('.app-header__inner');
  out.header = hi ? {cw: hi.clientWidth, sw: hi.scrollWidth} : null;

  // ---- 1. text clipped inside its own box ----
  const clipped = [];
  const hiddenByAncestor = (el) => hasAncestor(el, (cs) =>
    cs.overflowX === 'hidden' || cs.overflowX === 'clip');
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (cs.textOverflow === 'ellipsis') continue;          // intended truncation
    if (cs.webkitLineClamp && cs.webkitLineClamp !== 'none') continue;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') continue;
    if (scrollsX(cs) || cs.overflowX === 'hidden' || cs.overflowX === 'clip') continue;
    if (hasAncestor(el, scrollsX)) continue;               // reachable by scroll
    if (hiddenByAncestor(el)) continue;                    // hidden by design (rail/drawer)
    if (el.closest('.app-header__bell')) continue;          // count badge overflows on purpose
    if (el.closest('.db-bars__col')) continue;              // chart label column
    if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 30) {
      clipped.push({t: cls(el), cw: el.clientWidth, sw: el.scrollWidth,
                    txt: (el.textContent || '').trim().slice(0, 28)});
    }
  }
  out.clipped = clipped.slice(0, 14);

  // ---- 2. descendants sticking out of their card ----
  const CARDS = '.card, .db-chart-card, .statc, .cl-card, .cd-card, .db-section, .modal, .login-card, .appr-row, .empty-state, .au-card';
  const contained = (el, card) => {
    let p = el.parentElement;
    while (p && p !== card) {
      const cs = getComputedStyle(p);
      if (scrollsX(cs) || cs.overflowX === 'hidden' || cs.overflowX === 'clip') return true;
      p = p.parentElement;
    }
    const ccs = getComputedStyle(card);
    return scrollsX(ccs) || ccs.overflowX === 'hidden' || ccs.overflowX === 'clip';
  };
  const escapees = [];
  for (const card of document.querySelectorAll(CARDS)) {
    const ccs = getComputedStyle(card);
    if (ccs.display === 'none') continue;
    const cb = card.getBoundingClientRect();
    if (cb.width < 40) continue;
    for (const el of card.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
      if (cs.textOverflow === 'ellipsis') continue;
      const b = el.getBoundingClientRect();
      if (b.width < 4 || b.height < 4) continue;
      const over = Math.max(b.right - cb.right, cb.left - b.left);
      if (over > 3) {
        if (contained(el, card)) continue;                  // clipped/scrollable inside
        if (el.classList && (el.classList.contains('bell-count'))) continue;
        escapees.push({card: (typeof card.className === 'string' ? card.className.split(' ')[0] : 'card'),
                       el: cls(el), over: Math.round(over),
                       txt: (el.textContent || '').trim().slice(0, 24)});
      }
    }
  }
  escapees.sort((a, b) => b.over - a.over);
  out.escapees = escapees.slice(0, 10);

  // ---- 3. tables ----
  out.tables = [];
  for (const t of document.querySelectorAll('table')) {
    const cs = getComputedStyle(t);
    if (cs.display === 'none') continue;
    const scrollable = hasAncestor(t, scrollsX);
    const tds = Array.from(t.querySelectorAll('tbody td'));
    const labelled = tds.filter((td) => td.hasAttribute('data-label')).length;
    const firstTr = t.querySelector('tbody tr');
    const stacked = firstTr ? ['block', 'grid'].includes(getComputedStyle(firstTr).display) : false;
    const missing = tds.length - labelled;
    const wrapCls = t.parentElement && typeof t.parentElement.className === 'string'
      ? t.parentElement.className.split(' ')[0] : '';
    const info = {cls: (typeof t.className === 'string' ? t.className : '') || '(none)',
                  w: Math.round(t.getBoundingClientRect().width),
                  tds: tds.length, labelled, stacked, scrollable, wrap: wrapCls};
    out.tables.push(info);
    info.unusable = (!stacked && !scrollable && info.w > out.vw - 8);
    info.badLabel = stacked && missing > 0;
  }

  // ---- 4. touch targets ----
  const small = [];
  const sel = 'a, button, [role="button"], input:not([type=checkbox]):not([type=radio]), select, textarea, [onclick]';
  for (const el of document.querySelectorAll(sel)) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (el.closest('.ws-')) continue;                       // marketing site own audit
    if (el.classList && el.classList.contains('db-bars__col')) continue; // chart column
    const b = el.getBoundingClientRect();
    if (b.width < 4 || b.height < 4) continue;
    // inline prose links are exempt (WCAG 2.5.5 inline exception)
    const parent = el.parentElement;
    if (el.tagName === 'A' && parent && getComputedStyle(parent).display.startsWith('inline')
        && !el.classList.contains('crumbs')) continue;
    if (b.height < 40 || b.width < 40) {
      small.push({t: cls(el), w: Math.round(b.width), h: Math.round(b.height),
                  txt: (el.textContent || el.value || '').trim().slice(0, 18)});
    }
  }
  out.small = small.slice(0, 14);

  // ---- 5. inputs smaller than 16px (iOS zoom) ----
  const zoomy = [];
  for (const el of document.querySelectorAll('input, select, textarea')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none') continue;
    if (el.type === 'checkbox' || el.type === 'radio' || el.type === 'file') continue;
    const fs = parseFloat(cs.fontSize);
    if (fs < 16) zoomy.push({t: (el.id || el.type || el.tagName), fs});
  }
  out.zoomInputs = zoomy.slice(0, 8);

  // ---- 6. modal sheet geometry ----
  // harnesses render some modals inline (style="position:static; display:block")
  // so the page stays readable — force the real app behaviour (fixed flex
  // overlay) before measuring. Only those inline-styled overlays are touched.
  for (const ov of document.querySelectorAll('.modal-overlay')) {
    const st = ov.getAttribute('style') || '';
    if (!st.includes('position: static')) continue;
    ov.style.setProperty('position', 'fixed', 'important');
    ov.style.setProperty('inset', '0', 'important');
    ov.style.setProperty('display', 'flex', 'important');
  }
  out.modals = [];
  for (const m of document.querySelectorAll('.modal')) {
    const cs = getComputedStyle(m);
    if (cs.display === 'none') continue;
    const b = m.getBoundingClientRect();
    const closeBtn = m.querySelector('.modal__close');
    const ov = m.parentElement;
    const ocs = ov ? getComputedStyle(ov) : null;
    out.modals.push({
      fits: b.left >= -1 && b.right <= vw + 1 && b.bottom <= window.innerHeight + 1,
      atBottom: Math.abs(b.bottom - window.innerHeight) < 2,
      close: closeBtn ? getComputedStyle(closeBtn).display !== 'none' : null,
      w: Math.round(b.width),
      r: [Math.round(b.left), Math.round(b.right), Math.round(b.bottom)],
      tr: cs.transform === 'none' ? 'none' : 'T',
      ovCls: ov && typeof ov.className === 'string' ? ov.className.split(' ')[0] : '?',
      ovPos: ocs ? ocs.position : '?',
      vh: window.innerHeight,
    });
  }

  // ---- 7. filters toggle on phone ----
  const ft = document.querySelector('.filters-toggle');
  out.filtersToggle = ft
    ? {shown: getComputedStyle(ft).display !== 'none',
       w: Math.round(ft.getBoundingClientRect().width),
       h: Math.round(ft.getBoundingClientRect().height)}
    : null;

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
    total = {'clipped': 0, 'escapees': 0, 'small': 0, 'zoom': 0,
             'pageOverflow': 0, 'header': 0, 'tables': 0, 'badTable': 0,
             'modal': 0, 'toggle': 0}
    cases = []
    for p in PAGES:
        for w in WIDTHS:
            cases.append((p, w, 'ltr'))
        cases.append((p, 390, 'rtl'))

    for page, w, direction in cases:
        send('Emulation.setDeviceMetricsOverride',
             {'width': w, 'height': 844, 'deviceScaleFactor': 1, 'mobile': w < 500})
        send('Page.navigate', {'url': BASE + page})
        time.sleep(1.2)
        if direction == 'rtl':
            send('Runtime.evaluate', {
                'expression': "document.documentElement.dir='rtl';"
                              "document.documentElement.lang='ar';"})
            time.sleep(0.3)
        r = send('Runtime.evaluate', {'expression': EVAL_JS, 'returnByValue': True})
        try:
            d = json.loads(r['result']['result']['value'])
        except Exception as e:
            print(f'EVALERR {page} {w}/{direction}: {e}')
            continue
        probs = []
        tag = f'{page} @{w}{"/rtl" if direction == "rtl" else ""}'
        if d['rectOverflow'] > 1 or d['docScroll'] > 1:
            probs.append(f"PAGE-OVERFLOW rect={d['rectOverflow']} doc={d['docScroll']} ({d['worst']})")
            total['pageOverflow'] += 1
        if d['header'] and d['header']['sw'] > d['header']['cw'] + 1:
            probs.append(f"HEADER {d['header']}")
            total['header'] += 1
        if d['clipped']:
            probs.append(f"CLIPPED {d['clipped'][:4]}")
            total['clipped'] += len(d['clipped'])
        if d['escapees']:
            probs.append(f"ESCAPE {d['escapees'][:4]}")
            total['escapees'] += len(d['escapees'])
        # touch-target / iOS-zoom acceptance applies to phones + tablets;
        # desktop (>=1024) keeps its denser mouse-first sizing on purpose
        if w <= 1023 and d['small']:
            probs.append(f"SMALL {d['small'][:6]}")
            total['small'] += len(d['small'])
        if w <= 1023 and d['zoomInputs']:
            probs.append(f"ZOOM {d['zoomInputs'][:4]}")
            total['zoom'] += len(d['zoomInputs'])
        for t in d['tables']:
            total['tables'] += 1
            if t.get('unusable'):
                probs.append(f"TABLE-UNUSABLE {t}")
                total['badTable'] += 1
            if t.get('badLabel'):
                probs.append(f"TABLE-LABELS {t}")
                total['badTable'] += 1
        for m in d['modals']:
            need_close = w <= 1023
            need_bottom = w <= 767
            if (not m['fits']
                    or (need_close and m['close'] is False)
                    or (need_bottom and not m['atBottom'])):
                probs.append(f"MODAL {m}")
                total['modal'] += 1
        if d['filtersToggle'] is not None and w <= 767:
            ft = d['filtersToggle']
            if not ft['shown'] or ft['h'] < 40:
                probs.append(f"TOGGLE {ft}")
                total['toggle'] += 1
        status = 'OK  ' if not probs else 'FAIL'
        print(f'{status} {tag} ' + ('; '.join(probs) if probs else ''))
    print('\n=== totals ===', json.dumps(total))
    ws.close()


if __name__ == '__main__':
    run()
