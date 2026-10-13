"""Measure the tight bounding box of the mark group in the new logo SVG."""
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
  const g = document.querySelectorAll('svg > g')[0];
  const b = g.getBBox();
  return JSON.stringify({x: b.x, y: b.y, w: b.width, h: b.height});
})()""", 'returnByValue': True})
print(r.get('result', {}).get('value'))
ws.close()
