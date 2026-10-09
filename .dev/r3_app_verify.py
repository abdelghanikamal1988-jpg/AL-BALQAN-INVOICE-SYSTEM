"""Round 3: verify the carousel in the real React app (local dist build)
over CDP — spacing between Reports panels + one-card-per-row with arrows."""

import json
import sys
import time
import urllib.parse
import urllib.request

import websocket

PORT = 9333
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8099/dist/#/'
fails = []


def new_target(url):
    req = urllib.request.Request(
        'http://localhost:%d/json/new?%s' % (PORT, urllib.parse.quote(url, safe='')),
        method='PUT')
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.load(r)


t = new_target('about:blank')
ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=60)
mid = [0]


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


cmd('Page.enable')
cmd('Runtime.enable')
cmd('Emulation.setDeviceMetricsOverride',
    {'width': 390, 'height': 844, 'deviceScaleFactor': 1, 'mobile': True})
cmd('Page.navigate', {'url': URL})
time.sleep(5)

state = js("""JSON.stringify({
  login: !!document.querySelector('input[type=password]'),
  email: (document.querySelector('input[type=email]') || {}).value || '',
  pw: (document.querySelector('input[type=password]') || {}).value || '',
  href: location.href
})""", 1)
print('STATE:', state)
state = json.loads(state) if isinstance(state, str) else {}

if state.get('login'):
    if not state.get('email') or not state.get('pw'):
        js("""(() => {
          const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          const e = document.querySelector('input[type=email]');
          const p = document.querySelector('input[type=password]');
          if (e && !e.value) { set.call(e, 'admin@albalqan.com'); e.dispatchEvent(new Event('input', {bubbles: true})); }
          if (p && !p.value) { set.call(p, 'admin123'); p.dispatchEvent(new Event('input', {bubbles: true})); }
          return 'filled';
        })()""")
    print('SUBMIT:', js("""(() => {
      const b = document.querySelector('.login-form button[type=submit], form button[type=submit]');
      if (!b) return 'no-btn';
      b.click();
      return 'clicked';
    })()"""))
    time.sleep(6)

page = js("""JSON.stringify({
  login: !!document.querySelector('input[type=password]'),
  shell: !!document.querySelector('.app-shell'),
  panels: document.querySelectorAll('.db-section > .db-panel').length,
  navs: document.querySelectorAll('.db-cardnav').length,
  actives: document.querySelectorAll('.db-panel .db-inv tbody tr.is-active').length
})""")
print('PAGE:', page)
page = json.loads(page) if isinstance(page, str) else {}
check('signed in (shell)', page.get('shell') is True, page)
check('4 Reports panels', page.get('panels') == 4, page.get('panels'))
check('4 carousels mounted', page.get('navs') == 4, page.get('navs'))
check('4 active rows', page.get('actives') == 4, page.get('actives'))

PROBE = """(() => {
  const panels = [...document.querySelectorAll('.db-section > .db-panel')];
  const out = {vw: innerWidth, panels: [], gaps: []};
  for (const p of panels) {
    const t = p.querySelector('.db-inv');
    if (!t) continue;
    const rows = [...t.querySelectorAll('tbody tr')];
    const vis = rows.filter((r) => getComputedStyle(r).display !== 'none');
    const nav = p.querySelector('.db-cardnav');
    out.panels.push({
      label: p.getAttribute('aria-label'),
      rows: rows.length,
      visible: vis.length,
      active: rows.findIndex((r) => r.classList.contains('is-active')),
      tfoot: t.tFoot ? getComputedStyle(t.tFoot).display : null,
      nav: nav ? getComputedStyle(nav).display : null,
      btn: nav ? [...nav.querySelectorAll('button')].map((b) => {
        const r = b.getBoundingClientRect();
        return Math.round(r.width) + 'x' + Math.round(r.height);
      }) : null,
      idx: nav ? nav.querySelector('.db-cardnav__idx').textContent.trim() : null
    });
  }
  for (let i = 0; i < panels.length - 1; i++) {
    const a = panels[i].getBoundingClientRect();
    const b = panels[i + 1].getBoundingClientRect();
    out.gaps.push(Math.round(b.top - a.bottom));
  }
  return JSON.stringify(out);
})()"""

d = json.loads(js(PROBE))
print('PHONE:', json.dumps(d, indent=1))
if d['panels']:
    check('panel gaps 16px', d['gaps'] == [16, 16, 16], d['gaps'])
    for p in d['panels']:
        check('one card @ %s' % p['label'], p['visible'] == 1, p['visible'])
        check('nav @ %s' % p['label'], p['nav'] == 'flex', p['nav'])
        check('44px arrows @ %s' % p['label'],
              p['btn'] and all(b == '44x44' for b in p['btn']), p['btn'])
    first = d['panels'][0]
    click = js("""(() => {
      const p = document.querySelector('.db-section > .db-panel');
      const rows = [...p.querySelectorAll('.db-inv tbody tr')];
      const idx = p.querySelector('.db-cardnav__idx');
      const st = () => rows.findIndex((r) => r.classList.contains('is-active')) + '|' + idx.textContent.trim();
      const before = st();
      p.querySelector('.db-cardnav__btn--next').click();
      return JSON.stringify({before, after: st(),
        vis: rows.filter((r) => getComputedStyle(r).display !== 'none').length});
    })()""", 0.3)
    print('CLICK:', click)
    click = json.loads(click) if isinstance(click, str) else {}
    check('react next advances', click.get('after') == '1|2 / %s' % first['rows'], click)
    check('react still one card', click.get('vis') == 1, click)

cmd('Emulation.setDeviceMetricsOverride',
    {'width': 1024, 'height': 900, 'deviceScaleFactor': 1, 'mobile': False})
time.sleep(0.6)
d2 = json.loads(js(PROBE))
print('DESKTOP:', json.dumps(d2, indent=1))
if d2['panels']:
    check('desktop all rows visible',
          all(p['visible'] == p['rows'] for p in d2['panels']),
          [(p['visible'], p['rows']) for p in d2['panels']])
    check('desktop nav hidden', all(p['nav'] == 'none' for p in d2['panels']),
          [p['nav'] for p in d2['panels']])
    check('desktop tfoot shown',
          all(p['tfoot'] in (None, 'table-footer-group') for p in d2['panels']),
          [p['tfoot'] for p in d2['panels']])

ws.close()
print()
print('TOTAL FAILS:', len(fails), fails)
