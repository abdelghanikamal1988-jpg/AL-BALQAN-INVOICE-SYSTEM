import json
import sys
import time
import urllib.request

import websocket

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

URL = ("file:///C:/Users/hp/OneDrive/Desktop/desktop%20298/"
       "AL%20BALQAN%20Invoice%20system/.dev/preview-dashboard.html")

JS = r"""
(() => {
  const r = (el) => { const b = el.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.width)]; };
  const snap = () => {
    const out = {};
    const hero = document.querySelector('.db-hero__actions'); out.hero = hero ? r(hero) : null;
    const all = [...document.querySelectorAll('.statc')];
    out.first = all[0] ? r(all[0]) : null;
    out.last = all.length ? r(all[all.length-1]) : null;
    const si = document.querySelector('.topsearch__input'); out.search = si ? r(si) : null;
    const th = document.querySelector('.db-table-wrap th'); out.th = th ? r(th) : null;
    const sec = document.querySelector('.db-section__head'); out.sec = sec ? r(sec) : null;
    return out;
  };
  const ltr = snap();
  document.documentElement.setAttribute('dir','rtl');
  document.documentElement.setAttribute('lang','ar');
  void document.body.offsetHeight;
  const rtl = snap();
  document.documentElement.setAttribute('dir','ltr');
  document.documentElement.setAttribute('lang','en');
  return JSON.stringify({ltr, rtl});
})()
"""

tabs = json.load(urllib.request.urlopen('http://127.0.0.1:9333/json/list', timeout=5))
ws = websocket.create_connection(tabs[0]['webSocketDebuggerUrl'], timeout=15)
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
     {'width': 1440, 'height': 900, 'deviceScaleFactor': 1, 'mobile': False})
send('Page.navigate', {'url': URL})
time.sleep(2.5)
res = send('Runtime.evaluate', {'expression': JS, 'returnByValue': True})
print(json.dumps(res.get('result', {}).get('result', {}).get('value'), indent=1))
ws.close()
