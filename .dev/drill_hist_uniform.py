"""Uniformity baseline for the clients / invoice-history stacked tables:
per-table card (row) heights and clipped cells at phone widths."""

import json
import time
import urllib.parse
import urllib.request

import websocket

PORT = 9333
ROOT = (r'C:\Users\hp\OneDrive\Desktop\desktop 298\AL BALQAN Invoice system'
        r'\.dev')
PAGES = ['preview-clients.html', 'preview-history.html', 'preview-hist-test.html']
TABLES = ['.cl-table', '.history-table']


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


MEASURE = """(() => {
  const out = [];
  for (const sel of %s) {
    for (const t of document.querySelectorAll(sel)) {
      const rows = [...t.querySelectorAll('tbody tr')];
      if (!rows.length) continue;
      const hs = rows.map((r) => Math.round(r.getBoundingClientRect().height));
      const clipped = [];
      for (const c of t.querySelectorAll('td')) {
        const dx = c.scrollWidth - c.clientWidth;
        const dy = c.scrollHeight - c.clientHeight;
        if (dx > 1 || dy > 1) {
          clipped.push((c.className || '?') + ' +' + dx + '/' + dy
                       + ' :: ' + c.textContent.trim().replace(/\\s+/g, ' ').slice(0, 30));
        }
      }
      out.push({cls: t.className, n: rows.length, hs: hs,
                spread: Math.max(...hs) - Math.min(...hs),
                clipped: clipped.slice(0, 6)});
    }
  }
  return JSON.stringify(out);
})()"""

cmd('Page.enable')
cmd('Runtime.enable')
cmd('Emulation.setDeviceMetricsOverride',
    {'width': 390, 'height': 844, 'deviceScaleFactor': 1, 'mobile': True})

for page in PAGES:
    url = 'file:///' + urllib.parse.quote((ROOT + '\\' + page).replace('\\', '/'), safe='/:')
    cmd('Page.navigate', {'url': url})
    time.sleep(3)
    print('\n=== ' + page)
    for r in json.loads(js(MEASURE % json.dumps(TABLES))):
        print('  %-16s n=%-3d spread=%-3d %s' % (r['cls'], r['n'], r['spread'], r['hs'][:12]))
        for c in r['clipped']:
            print('      clip:', c)

ws.close()
