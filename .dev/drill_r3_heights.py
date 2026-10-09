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
    return r.get('result', {}).get('value')


cmd('Page.enable')
cmd('Runtime.enable')

PROBE = """(() => {
  const sec = [...document.querySelectorAll('.db-section')]
    .find((s) => s.querySelector('.db-panel'));
  const panels = [...document.querySelectorAll('.db-section > .db-panel')];
  const rows = document.querySelectorAll('.db-panel .db-inv tbody tr');
  return JSON.stringify({
    vw: innerWidth,
    docH: document.documentElement.scrollHeight,
    sectionH: sec ? Math.round(sec.getBoundingClientRect().height) : null,
    panelH: panels.map((p) => Math.round(p.getBoundingClientRect().height)),
    rowCount: rows.length
  });
})()"""

for w in (390, 1024):
    cmd('Emulation.setDeviceMetricsOverride',
        {'width': w, 'height': 844, 'deviceScaleFactor': 1, 'mobile': w <= 767})
    cmd('Page.navigate', {'url': URL})
    time.sleep(3)
    print(w, js(PROBE))

ws.close()
