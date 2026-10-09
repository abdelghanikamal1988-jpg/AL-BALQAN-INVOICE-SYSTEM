"""Compare CSS variants for the stacked dashboard cards and report, per table:
row-height spread (0 = perfectly uniform) and max horizontal overflow."""

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

VARIANTS = [
    ('baseline', ''),
    ('A nowrap one line',
     '.db-panel .db-inv tbody tr{display:grid!important}'
     '.db-panel .db-inv td{flex-wrap:nowrap;white-space:nowrap}'
     '.db-panel .db-inv td::before{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}'),
    ('B two-line cells',
     '.db-panel .db-inv tbody tr{display:grid!important}'
     '.db-panel .db-inv td{flex-direction:column;align-items:flex-start;'
     'justify-content:flex-start;gap:2px;white-space:normal}'),
    ('C two-line + 2-line value floor',
     '.db-panel .db-inv tbody tr{display:grid!important}'
     '.db-panel .db-inv td{flex-direction:column;align-items:flex-start;'
     'justify-content:flex-start;gap:2px;white-space:normal}'
     '.db-panel .db-inv td{min-height:0}'
     '.db-panel .db-inv tbody tr{grid-auto-rows:minmax(0,1fr)}'),
    ('D one line + cell min-height',
     '.db-panel .db-inv tbody tr{display:grid!important}'
     '.db-panel .db-inv td{flex-wrap:nowrap;white-space:nowrap;min-height:44px}'
     '.db-panel .db-inv td::before{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}'),
]

MEASURE = """(() => {
  const out = [];
  for (const p of document.querySelectorAll('.db-section > .db-panel')) {
    const t = p.querySelector('.db-inv');
    if (!t) continue;
    const rows = [...t.querySelectorAll('tbody tr')];
    const hs = rows.map((r) => Math.round(r.getBoundingClientRect().height));
    let over = 0, overTxt = '';
    for (const c of t.querySelectorAll('tbody td')) {
      const dx = c.scrollWidth - c.clientWidth;
      const dy = c.scrollHeight - c.clientHeight;
      if (dx > over) { over = dx; overTxt = c.textContent.trim().slice(0, 30); }
      if (dy > 0) over = Math.max(over, dy + 1000);
    }
    out.push({label: p.getAttribute('aria-label'), hs: hs,
              spread: Math.max(...hs) - Math.min(...hs),
              over: over, overTxt: overTxt});
  }
  return JSON.stringify(out);
})()"""

for name, css in VARIANTS:
    js("""(() => {
      let s = document.getElementById('variant');
      if (!s) { s = document.createElement('style'); s.id = 'variant'; document.head.appendChild(s); }
      s.textContent = %s;
      return 'ok';
    })()""" % json.dumps(css), 0.4)
    print('\n### ' + name)
    for r in json.loads(js(MEASURE)):
        print('  %-18s spread=%-3d heights=%s  overflow=%spx %r'
              % (r['label'], r['spread'], r['hs'], r['over'], r['overTxt'][:26]))

ws.close()
