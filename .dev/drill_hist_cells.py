"""Per-cell height dump for the clients / invoice-history stacked tables so the
uniform cell floors can be chosen from real measurements."""

import json
import time
import urllib.parse
import urllib.request

import websocket

PORT = 9333
ROOT = (r'C:\Users\hp\OneDrive\Desktop\desktop 298\AL BALQAN Invoice system'
        r'\.dev')
TARGETS = [('preview-clients.html', '.cl-table'),
           ('preview-history.html', '.history-table')]


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
  const t = document.querySelector(%s);
  if (!t) return 'null';
  const rows = [...t.querySelectorAll('tbody tr')];
  const head = [...t.querySelectorAll('thead th')].map((h) => h.textContent.trim());
  const out = rows.map((r, ri) => ({
    h: Math.round(r.getBoundingClientRect().height),
    cells: [...r.cells].map((c, ci) => ({
      i: ci,
      cls: c.className || '',
      lab: c.getAttribute('data-label') || '',
      h: Math.round(c.getBoundingClientRect().height),
      fs: getComputedStyle(c).fontSize,
      txt: c.textContent.trim().replace(/\\s+/g, ' ').slice(0, 34)
    }))
  }));
  return JSON.stringify({head: head, rows: out});
})()"""

cmd('Page.enable')
cmd('Runtime.enable')
cmd('Emulation.setDeviceMetricsOverride',
    {'width': 390, 'height': 844, 'deviceScaleFactor': 1, 'mobile': True})

for page, sel in TARGETS:
    url = 'file:///' + urllib.parse.quote((ROOT + '\\' + page).replace('\\', '/'), safe='/:')
    cmd('Page.navigate', {'url': url})
    time.sleep(3)
    data = js(MEASURE % json.dumps(sel))
    if data == 'null':
        print('!! no table', page)
        continue
    d = json.loads(data)
    print('\n=== %s %s' % (page, sel))
    print('  cols:', d['head'])
    print('  row heights:', [r['h'] for r in d['rows']])
    per = {}
    for r in d['rows']:
        for c in r['cells']:
            per.setdefault(c['i'], []).append((c['h'], c['cls'], c['lab'], c['txt']))
    for i in sorted(per):
        vals = per[i]
        hs = [v[0] for v in vals]
        flag = '  <-- VARIES' if max(hs) - min(hs) > 1 else ''
        print('   [%2d] %-16s %-10s h=%-18s%s' % (i, vals[0][1][:16], vals[0][2][:10],
                                                   str(hs), flag))
        if flag:
            for v in vals:
                print('         h=%-4d %r' % (v[0], v[3]))

ws.close()
