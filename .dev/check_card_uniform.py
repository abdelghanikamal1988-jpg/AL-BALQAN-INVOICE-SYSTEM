"""Uniformity check: every card (tbody row) inside a dashboard Reports table
must have the same height, and no cell may be clipped."""

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


cmd('Page.enable')
cmd('Runtime.enable')

MEASURE = """(() => {
  const out = [];
  for (const p of document.querySelectorAll('.db-section > .db-panel')) {
    const t = p.querySelector('.db-inv');
    if (!t) continue;
    const rows = [...t.querySelectorAll('tbody tr')];
    const hs = rows.map((r) => Math.round(r.getBoundingClientRect().height));
    const clipped = [];
    for (const c of t.querySelectorAll('td')) {
      const dx = c.scrollWidth - c.clientWidth;
      const dy = c.scrollHeight - c.clientHeight;
      if (dx > 1 || dy > 1) {
        clipped.push((c.getAttribute('data-label') || '?') + ' +' + dx + '/' + dy
                     + ' :: ' + c.textContent.trim().slice(0, 34));
      }
    }
    out.push({label: p.getAttribute('aria-label'), n: rows.length, hs: hs,
              spread: Math.max(...hs) - Math.min(...hs), clipped: clipped,
              h: Math.round(p.getBoundingClientRect().height)});
  }
  return JSON.stringify(out);
})()"""

FORCE = """(() => {
  let s = document.getElementById('force');
  if (!s) { s = document.createElement('style'); s.id = 'force'; document.head.appendChild(s); }
  s.textContent = '.db-panel .db-inv tbody tr { display: grid !important; }';
  return 'on';
})()"""

for w in (360, 390, 414):
    cmd('Emulation.setDeviceMetricsOverride',
        {'width': w, 'height': 844, 'deviceScaleFactor': 1, 'mobile': True})
    cmd('Page.navigate', {'url': URL})
    time.sleep(3)
    js(FORCE, 0.4)
    print('\n--- %dpx ---' % w)
    for r in json.loads(js(MEASURE)):
        check('%d %s uniform (%d cards)' % (w, r['label'], r['n']),
              r['spread'] == 0, 'heights=%s' % r['hs'])
        check('%d %s no clipped cell' % (w, r['label']),
              not r['clipped'], r['clipped'][:3])

ws.close()
print()
print('TOTAL FAILS:', len(fails), fails)
