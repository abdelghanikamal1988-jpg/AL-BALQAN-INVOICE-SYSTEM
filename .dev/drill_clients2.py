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
send('Page.navigate', {'url': BASE + 'preview-clients.html'})
time.sleep(1.5)

JS = r"""
(() => {
  const out = {};
  out.kids = [...document.querySelector('.page').children].map(k => {
    const cs = getComputedStyle(k);
    const r = k.getBoundingClientRect();
    return {cls: (k.className || k.tagName).toString().slice(0, 40),
            h: Math.round(r.height), mb: cs.marginBottom};
  });
  const tr = document.querySelector('.cl-table tbody tr');
  if (tr) {
    const rs = getComputedStyle(tr);
    out.tr = {disp: rs.display, h: Math.round(tr.getBoundingClientRect().height),
      cols: rs.gridTemplateColumns};
    out.cells = [...tr.children].map(c => {
      const r = c.getBoundingClientRect();
      return {dl: c.getAttribute('data-label'), h: Math.round(r.height),
              w: Math.round(r.width),
              txt: (c.textContent || '').trim().slice(0, 42)};
    });
  }
  return JSON.stringify(out, null, 1);
})()
"""
r = send('Runtime.evaluate', {'expression': JS, 'returnByValue': True})
print(r['result']['result'].get('value'))
ws.close()
