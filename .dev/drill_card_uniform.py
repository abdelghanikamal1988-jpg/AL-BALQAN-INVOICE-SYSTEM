"""Measure per-card (per-row) height variance inside each dashboard Reports
table at phone width, and which cells make a card taller than its siblings."""

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


cmd('Page.enable')
cmd('Runtime.enable')
cmd('Emulation.setDeviceMetricsOverride',
    {'width': 390, 'height': 844, 'deviceScaleFactor': 1, 'mobile': True})
cmd('Page.navigate', {'url': URL})
time.sleep(3)

print(js("""(() => {
  const s = document.createElement('style');
  s.textContent = '.db-panel .db-inv tbody tr { display: grid !important; }';
  document.head.appendChild(s);
  return 'forced';
})()""", 0.5))

PROBE = """(() => {
  const out = [];
  for (const p of document.querySelectorAll('.db-section > .db-panel')) {
    const t = p.querySelector('.db-inv');
    if (!t) continue;
    const rows = [...t.querySelectorAll('tbody tr')];
    const info = {label: p.getAttribute('aria-label'), cells: rows[0].cells.length,
                  heights: [], rows: []};
    for (const r of rows) {
      const h = Math.round(r.getBoundingClientRect().height);
      info.heights.push(h);
      const cells = [...r.cells].map((c) => {
        const cs = getComputedStyle(c);
        const b = c.getBoundingClientRect();
        const inner = c.firstElementChild;
        return {
          lab: c.getAttribute('data-label') || '',
          txt: c.textContent.trim().slice(0, 26),
          cls: c.className,
          h: Math.round(b.height),
          wrap: cs.whiteSpace,
          ff: c.scrollWidth > c.clientWidth + 1,
          fw: cs.fontWeight,
          fs: cs.fontSize,
          inner: inner ? inner.className + '/' + Math.round(inner.getBoundingClientRect().height) : ''
        };
      });
      info.rows.push({h: h, cells: cells});
    }
    out.push(info);
  }
  return JSON.stringify(out);
})()"""

data = json.loads(js(PROBE))

for info in data:
    hs = info['heights']
    print('\n=== %s  cells=%d rows=%d' % (info['label'], info['cells'], len(hs)))
    print('  heights:', hs, '| min=%d max=%d delta=%d' % (min(hs), max(hs), max(hs) - min(hs)))
    tall = max(hs)
    for i, row in enumerate(info['rows']):
        if row['h'] < tall:
            continue
        print('  row %d h=%d' % (i, row['h']))
        for c in row['cells']:
            if c['h'] > 34 or c['ff']:
                print('     %-12s h=%-3d ws=%-10s fw=%-3s cls=%s' %
                      (c['lab'], c['h'], c['wrap'], c['fw'], c['cls']))
                print('        txt=%r  nowrap-overflow=%s inner=%s' %
                      (c['txt'], c['ff'], c['inner']))

ws.close()
