import json
import sys
import time
import urllib.request

import websocket

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE = ("file:///C:/Users/hp/OneDrive/Desktop/desktop%20298/"
        "AL%20BALQAN%20Invoice%20system/.dev/")

JS_DARK = r"""
(() => {
  const cs = (sel) => { const e = document.querySelector(sel); if (!e) return null;
    const s = getComputedStyle(e); return {bg: s.backgroundColor, fg: s.color}; };
  const out = {};
  out.body = cs('body');
  out.card = cs('.card, .cl-table, .page');
  out.h1 = cs('h1');
  out.overflow = document.documentElement.scrollWidth - window.innerWidth;
  document.documentElement.setAttribute('data-theme','dark');
  void document.body.offsetHeight;
  out.bodyDark = cs('body');
  out.cardDark = cs('.card, .cl-table, .page');
  out.h1Dark = cs('h1');
  return JSON.stringify(out);
})()
"""

JS_PHONE = r"""
(() => {
  const lang = document.querySelector('.app-header__tool--lang');
  const theme = document.querySelector('.app-header__tool--theme');
  const tools = [...document.querySelectorAll('.app-header__tool')]
    .map(e => ({cls: e.className, d: getComputedStyle(e).display}));
  const out = {
    lang: lang ? getComputedStyle(lang).display : 'MISSING',
    theme: theme ? getComputedStyle(theme).display : 'MISSING',
    tools,
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    w: window.innerWidth
  };
  return JSON.stringify(out);
})()
"""

jobs = [
    ('preview-clients.html', 1440, 900, JS_DARK, 'dark-clients'),
    ('preview-dashboard.html', 390, 844, JS_PHONE, 'phone-toggles'),
    ('preview-history.html', 390, 844, JS_PHONE, 'phone-toggles-history'),
]

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
for page, w, h, js, label in jobs:
    send('Emulation.setDeviceMetricsOverride',
         {'width': w, 'height': h, 'deviceScaleFactor': 1, 'mobile': w < 500})
    send('Page.navigate', {'url': BASE + page})
    time.sleep(2.2)
    res = send('Runtime.evaluate', {'expression': js, 'returnByValue': True})
    val = res.get('result', {}).get('result', {}).get('value')
    print(f'[{label}]', val)
ws.close()
