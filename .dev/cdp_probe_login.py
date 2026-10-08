import json
import sys
import time
import urllib.request

import websocket

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE = ("file:///C:/Users/hp/OneDrive/Desktop/desktop%20298/"
        "AL%20BALQAN%20Invoice%20system/.dev/")

JS = r"""
(() => {
  const out = {
    tools: document.querySelectorAll('.app-header__tool').length,
    langBtn: !!document.querySelector('.app-header__tool--lang'),
    themeBtn: !!document.querySelector('.app-header__tool--theme'),
    dir: document.documentElement.dir,
    lang: document.documentElement.lang,
    overflow: document.documentElement.scrollWidth - window.innerWidth
  };
  return JSON.stringify(out);
})()
"""

pages = ['preview-login.html', 'preview-gate.html', 'preview-shell.html']
tabs = json.load(urllib.request.urlopen('http://127.0.0.1:9333/json/list', timeout=5))
ws = websocket.create_connection(tabs[0]['webSocketDebuggerUrl'], timeout=20)
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
for p in pages:
    send('Page.navigate', {'url': BASE + p})
    time.sleep(1.8)
    res = send('Runtime.evaluate', {'expression': JS, 'returnByValue': True})
    print(p, res.get('result', {}).get('result', {}).get('value'))
ws.close()
