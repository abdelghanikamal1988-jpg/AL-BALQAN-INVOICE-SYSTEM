import json
import sys
import time
import urllib.request

import websocket

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE = ('file:///C:/Users/hp/OneDrive/Desktop/desktop%20298/'
        'AL%20BALQAN%20Invoice%20system/.dev/')

tabs = json.load(urllib.request.urlopen('http://127.0.0.1:9333/json/list', timeout=5))
t = next((x for x in tabs if x['type'] == 'page'), tabs[0])
ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=30)
mid = 0


def send(method, params=None):
    global mid
    mid += 1
    ws.send(json.dumps({'id': mid, 'method': method, 'params': params or {}}))
    while True:
        msg = json.loads(ws.recv())
        if msg.get('id') == mid:
            return msg


send('Page.enable')
send('Emulation.setDeviceMetricsOverride',
     {'width': 390, 'height': 844, 'deviceScaleFactor': 1, 'mobile': True})
send('Page.navigate', {'url': BASE + 'preview-dashboard.html'})
time.sleep(1.5)

JS = r"""
(() => {
  const page = document.querySelector('.page');
  const rows = [];
  for (const k of page.children) {
    const r = k.getBoundingClientRect();
    const s = getComputedStyle(k);
    rows.push({
      cls: (k.className || k.tagName).toString().slice(0, 40),
      top: Math.round(r.top), bottom: Math.round(r.bottom),
      h: Math.round(r.height),
      pos: s.position, mt: s.marginTop, mb: s.marginBottom,
      tr: s.transform === 'none' ? '' : 'TRANSFORM',
      order: s.order, disp: s.display,
    });
  }
  return JSON.stringify(rows, null, 0);
})()
"""
r = send('Runtime.evaluate', {'expression': JS, 'returnByValue': True})
for row in json.loads(r['result']['result']['value']):
    print(row)
ws.close()
