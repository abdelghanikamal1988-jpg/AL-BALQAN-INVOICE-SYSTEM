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
  const sec = [...page.children].find(k => k.className.includes('db-section')
    && k.getBoundingClientRect().height > 3000);
  if (!sec) return 'no tall section';
  const rows = [];
  const walk = (el, depth) => {
    if (depth > 4) return;
    for (const k of el.children) {
      const r = k.getBoundingClientRect();
      const s = getComputedStyle(k);
      rows.push({d: depth, cls: (k.className || k.tagName).toString().slice(0, 46),
                 h: Math.round(r.height), w: Math.round(r.width),
                 disp: s.display, ov: s.overflowX,
                 txt: (k.textContent || '').trim().slice(0, 30)});
      if (r.height > 1000) walk(k, depth + 1);
    }
  };
  walk(sec, 0);
  return JSON.stringify({head: sec.querySelector('.db-section__head') ?
    sec.querySelector('.db-section__head').textContent.trim().slice(0, 60) : '',
    rows: rows.slice(0, 40)}, null, 0);
})()
"""
r = send('Runtime.evaluate', {'expression': JS, 'returnByValue': True})
print(r['result']['result'].get('value'))
ws.close()
