"""How much stacked-card text ends up ellipsized in the clients/history cards."""

import json
import time
import urllib.parse
import urllib.request

import websocket

PORT = 9333
ROOT = (r'C:\Users\hp\OneDrive\Desktop\desktop 298\AL BALQAN Invoice system'
        r'\.dev')
TARGETS = [('preview-clients.html', '.cl-table'),
           ('preview-history.html', '.history-table'),
           ('preview-detail.html', '.cl-table')]


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


def js(expr):
    r = cmd('Runtime.evaluate',
            {'expression': expr, 'returnByValue': True, 'awaitPromise': True})
    if 'exceptionDetails' in r:
        return {'ERROR': r['exceptionDetails'].get('text')}
    return r.get('result', {}).get('value')


EXPR = """(() => {
  const t = document.querySelector(%s);
  if (!t) return 'null';
  const out = [];
  for (const c of t.querySelectorAll('td')) {
    const kids = [...c.children].filter((e) => e.tagName !== 'IMG');
    const els = kids.length ? kids : [c];
    for (const e of els) {
      const cut = e.scrollWidth - e.clientWidth;
      const name = (e.className || e.tagName) + '';
      out.push({el: name.slice(0, 18), cut: cut,
                lab: c.getAttribute('data-label') || '',
                txt: e.textContent.trim().replace(/\\s+/g, ' ').slice(0, 30)});
    }
  }
  return JSON.stringify(out);
})()"""

cmd('Page.enable')
cmd('Runtime.enable')
cmd('Emulation.setDeviceMetricsOverride',
    {'width': 390, 'height': 844, 'deviceScaleFactor': 1, 'mobile': True})

for page, sel in TARGETS:
    url = 'file:///' + urllib.parse.quote((ROOT + '\\' + page).replace('\\', '/'), safe='/:')
    cmd('Page.navigate', {'url': url})
    time.sleep(2.5)
    print('\n=== ' + page)
    for e in json.loads(js(EXPR % json.dumps(sel))):
        mark = '  <== ELLIPSIZED' if e['cut'] > 1 else ''
        if mark:
            print('   %-18s %-14s cut=%-3d %-24r%s' % (e['el'], e['lab'][:14],
                                                        e['cut'], e['txt'], mark))

ws.close()
