import json
import sys
import time
import urllib.request

import websocket

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

TARGET = ("https://abdelghanikamal1988-jpg.github.io/AL-BALQAN-INVOICE-SYSTEM/#/website")

JS = r"""
(() => {
  const res = {};
  const probe = (rootSel) => {
    const root = document.querySelector(rootSel);
    if (!root) return null;
    const out = [];
    const prevW = root.style.width;
    root.style.width = 'min-content';
    const minC = root.scrollWidth;
    root.style.width = prevW;
    out.push({t: 'ROOT', minContent: minC});
    for (const el of root.querySelectorAll('*')) {
      const s = getComputedStyle(el);
      if (s.display === 'none') continue;
      const pw = el.style.width;
      el.style.width = 'min-content';
      const mc = el.scrollWidth;
      el.style.width = pw;
      if (mc > 240) out.push({t: el.tagName + '.' + (typeof el.className === 'string' ? el.className.slice(0, 44) : ''),
                               minContent: mc, txt: (el.textContent || '').trim().slice(0, 40)});
    }
    return out.sort((a, b) => b.minContent - a.minContent).slice(0, 8);
  };
  res.sidebar = probe('.ws-consultation__sidebar');
  res.form = probe('.ws-consultation__form');
  return JSON.stringify(res);
})()
"""

tabs = json.load(urllib.request.urlopen('http://127.0.0.1:9333/json/list', timeout=5))
ws = websocket.create_connection(tabs[0]['webSocketDebuggerUrl'], timeout=30)
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
     {'width': 360, 'height': 844, 'deviceScaleFactor': 1, 'mobile': True})
send('Page.navigate', {'url': TARGET})
time.sleep(4.5)
res = send('Runtime.evaluate', {'expression': JS, 'returnByValue': True})
val = res.get('result', {}).get('result', {}).get('value')
print(json.dumps(json.loads(val), indent=1))
ws.close()
