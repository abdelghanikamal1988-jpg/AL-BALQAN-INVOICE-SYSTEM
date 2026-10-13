"""Measure the tight bounding boxes of every group in the source logo SVG."""
import json
import time
import urllib.parse
import urllib.request

import websocket

PORT = 9333
SVG = (r'C:\Users\hp\OneDrive\Desktop\Al Balqan Logo Black.svg')

req = urllib.request.Request(
    'http://localhost:%d/json/new?%s' % (PORT, urllib.parse.quote('file:///' + SVG.replace('\\', '/'), safe='/:' )),
    method='PUT')
with urllib.request.urlopen(req, timeout=10) as r:
    target = json.load(r)
ws = websocket.create_connection(target['webSocketDebuggerUrl'], timeout=30)
mid = [0]


def cmd(method, params=None):
    mid[0] += 1
    i = mid[0]
    ws.send(json.dumps({'id': i, 'method': method, 'params': params or {}}))
    while True:
        m = json.loads(ws.recv())
        if m.get('id') == i:
            return m.get('result', {})


cmd('Page.enable')
cmd('Runtime.enable')
time.sleep(1.2)
r = cmd('Runtime.evaluate', {'expression': """(() => {
  const out = [...document.querySelectorAll('svg > g')].map((g) => {
    const b = g.getBBox();
    return {x: +b.x.toFixed(2), y: +b.y.toFixed(2), w: +b.width.toFixed(2), h: +b.height.toFixed(2)};
  });
  const s = document.querySelector('svg');
  return JSON.stringify({svg: s.getAttribute('viewBox'), groups: out});
})()""", 'returnByValue': True})
print(r.get('result', {}).get('value'))
ws.close()
