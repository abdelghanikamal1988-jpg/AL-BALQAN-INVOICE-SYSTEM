import json
import sys
import time
import urllib.request

import websocket

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

JS = r"""
(() => {
  const vis = (el) => {
    if (!el) return 'MISSING';
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {d: s.display, v: s.visibility, w: Math.round(r.width), h: Math.round(r.height)};
  };
  const out = {};
  out.lang = vis(document.querySelector('.app-header__tool--lang'));
  out.theme = vis(document.querySelector('.app-header__tool--theme'));
  out.overflow = document.documentElement.scrollWidth - window.innerWidth;
  // find menu toggle button
  const btns = [...document.querySelectorAll('button')];
  const tog = btns.find(b => /toggle|burger|menu/i.test(b.className + ' ' + (b.getAttribute('aria-label')||'')));
  out.togClass = tog ? tog.className : null;
  if (tog) tog.click();
  return JSON.stringify(out);
})()
"""

JS2 = r"""
(() => {
  const vis = (el) => {
    if (!el) return 'MISSING';
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {d: s.display, v: s.visibility, w: Math.round(r.width), h: Math.round(r.height)};
  };
  const out = {
    lang: vis(document.querySelector('.app-header__tool--lang')),
    theme: vis(document.querySelector('.app-header__tool--theme')),
    overflow: document.documentElement.scrollWidth - window.innerWidth
  };
  // dark switch test
  document.documentElement.setAttribute('data-theme', 'dark');
  void document.body.offsetHeight;
  out.bgDark = getComputedStyle(document.body).backgroundColor;
  document.documentElement.setAttribute('data-theme', 'light');
  out.bgLight = getComputedStyle(document.body).backgroundColor;
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
time.sleep(4)
r1 = send('Runtime.evaluate', {'expression': JS, 'returnByValue': True})
print('[closed-menu]', r1.get('result', {}).get('result', {}).get('value'))
time.sleep(1.2)
r2 = send('Runtime.evaluate', {'expression': JS2, 'returnByValue': True})
print('[opened+dark]', r2.get('result', {}).get('result', {}).get('value'))
ws.close()
