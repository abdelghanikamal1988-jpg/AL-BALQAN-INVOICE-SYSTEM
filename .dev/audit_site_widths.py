import json
import sys
import time
import urllib.request

import websocket

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

TARGET = ("http://localhost:5173/#/website")

JS = r"""
(() => {
  const vw = window.innerWidth;
  const out = {vw};
  out.docOverflow = document.documentElement.scrollWidth - vw;
  const ov = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('.ws-partners__scroll')) continue;
    const s = getComputedStyle(el);
    if (s.display === 'none') continue;
    if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 40) {
      ov.push({t: (typeof el.className === 'string' ? el.className.slice(0, 46) : el.tagName),
               cw: el.clientWidth, sw: el.scrollWidth});
    }
  }
  out.innerOverflow = ov.slice(0, 12);
  const bad = {};
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('.ws-partners__scroll')) continue;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.position === 'fixed') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 3 || r.height < 3) continue;
    if (r.right > vw + 1) {
      const k = (typeof el.className === 'string' ? el.className.split(' ')[0] : el.tagName);
      bad[k] = (bad[k] || 0) + 1;
    }
  }
  out.overflowRight = bad;
  const t = document.querySelector('.ws-hero__title');
  const hero = document.querySelector('.ws-hero');
  if (t && hero) {
    const tr = t.getBoundingClientRect();
    out.heroTitleTop = Math.round(tr.top);
    out.heroH = Math.round(hero.getBoundingClientRect().height);
    out.heroContentPadTop = getComputedStyle(document.querySelector('.ws-hero__content') || hero).paddingTop;
  }
  const tog = document.querySelector('.ws-navbar__toggle');
  if (tog) { const r = tog.getBoundingClientRect(); out.toggle = [Math.round(r.width), Math.round(r.height)]; }
  return JSON.stringify(out);
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
for w in (320, 375, 412, 430, 768, 820, 1024):
    send('Emulation.setDeviceMetricsOverride',
         {'width': w, 'height': 800, 'deviceScaleFactor': 1, 'mobile': w < 800})
    send('Page.navigate', {'url': TARGET})
    time.sleep(3.5)
    res = send('Runtime.evaluate', {'expression': JS, 'returnByValue': True})
    val = res.get('result', {}).get('result', {}).get('value')
    print(f'--- {w} ---')
    print(val)
ws.close()
