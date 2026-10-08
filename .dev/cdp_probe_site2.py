import json
import sys
import time
import urllib.request

import websocket

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

JS = r"""
(() => {
  const out = {};
  out.url = location.href;
  out.title = document.title;
  out.text = (document.body.innerText || '').slice(0, 300);
  out.classes = [...new Set([...document.querySelectorAll('[class]')].map(e => (typeof e.className === 'string' ? e.className.split(' ')[0] : '')).filter(Boolean))].slice(0, 60);
  out.hasNavbar = !!document.querySelector('nav');
  out.buttons = [...document.querySelectorAll('button')].map(b => (b.className||'').slice(0,60)).slice(0, 20);
  return JSON.stringify(out);
})()
"""

tabs = json.load(urllib.request.urlopen('http://127.0.0.1:9333/json/list', timeout=5))
ws = websocket.create_connection(tabs[0]['webSocketDebuggerUrl'], timeout=25)
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
send('Page.navigate', {'url': 'http://localhost:5173/#/website'})
time.sleep(4.5)
r = send('Runtime.evaluate', {'expression': JS, 'returnByValue': True})
print(r.get('result', {}).get('result', {}).get('value'))
ws.close()
