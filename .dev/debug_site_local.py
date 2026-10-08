import json
import sys
import time
import urllib.request

import websocket

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

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
send('Runtime.enable')
send('Log.enable')
send('Emulation.setDeviceMetricsOverride',
     {'width': 390, 'height': 844, 'deviceScaleFactor': 1, 'mobile': True})
send('Page.navigate', {'url': 'http://127.0.0.1:8099/#/website'})
time.sleep(5)

# drain events briefly for console messages
logs = []
ws.settimeout(1.5)
for _ in range(30):
    try:
        m = json.loads(ws.recv())
    except Exception:
        break
    if m.get('method') in ('Runtime.consoleAPICalled', 'Log.entryAdded', 'Runtime.exceptionThrown'):
        logs.append(json.dumps(m)[:400])
ws.settimeout(30)

expr = r"""JSON.stringify({
  href: location.href,
  title: document.title,
  rootHtmlLen: (document.getElementById('root') || {}).innerHTML ? document.getElementById('root').innerHTML.length : 0,
  bodyText: document.body.innerText.slice(0, 260),
  scripts: [...document.scripts].map(s => s.src.split('/').pop()).slice(0, 8),
  css: [...document.styleSheets].map(s => (s.href || 'inline').split('/').pop()).slice(0, 8),
})"""
res = send('Runtime.evaluate', {'expression': expr, 'returnByValue': True})
print(res['result']['result'].get('value'))
print('\n--- console (%d) ---' % len(logs))
for l in logs[:12]:
    print(l)
ws.close()
