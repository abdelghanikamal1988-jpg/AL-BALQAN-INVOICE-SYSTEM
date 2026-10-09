"""Round 3 verification: panel spacing + mobile card carousel (arrows) on the
dashboard harness, measured over CDP (no screenshot — image read is broken)."""

import json
import time
import urllib.parse
import urllib.request

import websocket

PORT = 9333
PATH = (r'C:\Users\hp\OneDrive\Desktop\desktop 298\AL BALQAN Invoice system'
        r'\.dev\preview-dashboard.html')
URL = 'file:///' + urllib.parse.quote(PATH.replace('\\', '/'), safe='/:')


def new_target(url):
    req = urllib.request.Request(
        'http://localhost:%d/json/new?%s' % (PORT, urllib.parse.quote(url, safe='')),
        method='PUT')
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.load(r)


t = new_target('about:blank')
ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=60)
mid = [0]
fails = []


def cmd(method, params=None):
    mid[0] += 1
    i = mid[0]
    ws.send(json.dumps({'id': i, 'method': method, 'params': params or {}}))
    while True:
        m = json.loads(ws.recv())
        if m.get('id') == i:
            return m.get('result', {})


def js(expr, wait=0):
    if wait:
        time.sleep(wait)
    r = cmd('Runtime.evaluate',
            {'expression': expr, 'returnByValue': True, 'awaitPromise': True})
    if 'exceptionDetails' in r:
        return {'ERROR': r['exceptionDetails'].get('text')}
    return r.get('result', {}).get('value')


def check(name, cond, detail=''):
    print(('PASS ' if cond else 'FAIL ') + name + (' | ' + str(detail) if detail else ''))
    if not cond:
        fails.append(name)


def set_view(w, h, rtl=False):
    cmd('Emulation.setDeviceMetricsOverride',
        {'width': w, 'height': h, 'deviceScaleFactor': 1, 'mobile': w <= 767})
    js("document.documentElement.dir = '%s';" % ('rtl' if rtl else 'ltr'))
    time.sleep(0.4)


PROBE = """(() => {
  const panels = [...document.querySelectorAll('.db-section > .db-panel')];
  const out = {vw: innerWidth, rtl: document.documentElement.dir, panels: [], gaps: []};
  for (const p of panels) {
    const t = p.querySelector('.db-inv');
    if (!t) continue;
    const rows = [...t.querySelectorAll('tbody tr')];
    const vis = rows.filter((r) => getComputedStyle(r).display !== 'none');
    const nav = p.querySelector('.db-cardnav');
    const idx = nav ? nav.querySelector('.db-cardnav__idx') : null;
    out.panels.push({
      label: p.getAttribute('aria-label'),
      rows: rows.length,
      visible: vis.length,
      active: rows.findIndex((r) => r.classList.contains('is-active')),
      first: vis[0] ? vis[0].cells[0].textContent.trim().slice(0, 22) : null,
      tfoot: t.tFoot ? getComputedStyle(t.tFoot).display : null,
      tfootH: t.tFoot ? Math.round(t.tFoot.getBoundingClientRect().height) : null,
      nav: nav ? getComputedStyle(nav).display : null,
      btn: nav ? [...nav.querySelectorAll('button')].map((b) => {
        const r = b.getBoundingClientRect();
        return Math.round(r.width) + 'x' + Math.round(r.height);
      }) : null,
      idx: idx ? idx.textContent.trim() : null
    });
  }
  for (let i = 0; i < panels.length - 1; i++) {
    const a = panels[i].getBoundingClientRect();
    const b = panels[i + 1].getBoundingClientRect();
    out.gaps.push(Math.round(b.top - a.bottom));
  }
  return JSON.stringify(out);
})()"""

CLICK = """(() => {
  const p = document.querySelector('.db-section > .db-panel');
  const t = p.querySelector('.db-inv');
  const rows = [...t.querySelectorAll('tbody tr')];
  const idx = p.querySelector('.db-cardnav__idx');
  const st = () => rows.findIndex((r) => r.classList.contains('is-active')) + '|' + idx.textContent.trim();
  const before = st();
  p.querySelector('.db-cardnav__btn--next').click();
  const afterNext = st();
  p.querySelector('.db-cardnav__btn--next').click();
  const afterNext2 = st();
  for (let i = 0; i < 3; i++) p.querySelector('.db-cardnav__btn--prev').click();
  const afterPrev = st();
  p.querySelector('.db-cardnav__btn--prev').click();
  const afterWrap = st();
  const vis = rows.filter((r) => getComputedStyle(r).display !== 'none').length;
  return JSON.stringify({before, afterNext, afterNext2, afterPrev, afterWrap, vis, rows: rows.length});
})()"""

cmd('Page.enable')
cmd('Runtime.enable')

# ---- phone ----
set_view(390, 844)
cmd('Page.navigate', {'url': URL})
time.sleep(3)

d = json.loads(js(PROBE))
print('PHONE:', json.dumps(d, indent=1))
check('phone 4 panel tables', len(d['panels']) == 4, len(d['panels']))
for p in d['panels']:
    check('phone one card visible @ %s' % p['label'], p['visible'] == 1, p['visible'])
    check('phone active row @ %s' % p['label'], p['active'] == 0, p['active'])
    check('phone totals row kept @ %s' % p['label'],
          p['tfoot'] in (None, 'block', 'table-footer-group'), p['tfoot'])
    check('phone totals row rendered @ %s' % p['label'],
          p['tfootH'] is None or p['tfootH'] > 8, p['tfootH'])
    check('phone nav visible @ %s' % p['label'], p['nav'] == 'flex', p['nav'])
    check('phone 44px arrows @ %s' % p['label'],
          p['btn'] and all(b in ('44x44', '44x44') for b in p['btn']), p['btn'])
    check('phone counter @ %s' % p['label'],
          p['idx'] == '1 / %d' % p['rows'], (p['idx'], p['rows']))
check('panel gaps = 16px', d['gaps'] == [16, 16, 16], d['gaps'])

c = json.loads(js(CLICK))
print('CLICK:', c)
check('next advances row+index', c['before'] == '0|1 / 5' and c['afterNext'] == '1|2 / 5', c)
check('next again', c['afterNext2'] == '2|3 / 5', c)
check('prev walks back', c['afterPrev'] == '4|5 / 5', c)
check('prev wraps below first', c['afterWrap'] == '3|4 / 5', c)
check('still one card visible after clicks', c['vis'] == 1, c)

# ---- tablet: carousel off ----
set_view(768, 1024)
time.sleep(0.5)
d = json.loads(js(PROBE))
print('TABLET:', json.dumps(d, indent=1))
check('tablet all rows visible',
      all(p['visible'] == p['rows'] for p in d['panels']),
      [(p['visible'], p['rows']) for p in d['panels']])
check('tablet nav hidden', all(p['nav'] == 'none' for p in d['panels']),
      [p['nav'] for p in d['panels']])
check('tablet tfoot shown', all(p['tfoot'] != 'none' for p in d['panels']),
      [p['tfoot'] for p in d['panels']])

# ---- phone RTL ----
set_view(390, 844, rtl=True)
time.sleep(0.5)
d = json.loads(js(PROBE))
print('RTL:', json.dumps(d['panels'][0], indent=1), 'gaps', d['gaps'])
check('rtl one card visible', all(p['visible'] == 1 for p in d['panels']))
check('rtl nav visible', all(p['nav'] == 'flex' for p in d['panels']))
check('rtl 44px arrows', all(all(b == '44x44' for b in p['btn']) for p in d['panels']),
      [p['btn'] for p in d['panels']])
check('rtl gaps = 16px', d['gaps'] == [16, 16, 16], d['gaps'])

ws.close()
print()
print('TOTAL FAILS:', len(fails), fails)
