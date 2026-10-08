import json
import sys
import time
import urllib.request

import websocket

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

TARGET = 'http://localhost:5173/#/website'

JS = r"""
(() => {
  const vw = window.innerWidth;
  const out = {vw};

  // how-it-works steps fit
  const steps = [...document.querySelectorAll('.ws-step')];
  const grid = document.querySelector('.ws-how__grid');
  if (grid) {
    const gr = grid.getBoundingClientRect();
    out.how = {cw: grid.clientWidth, sw: grid.scrollWidth,
               steps: steps.map(s => Math.round(s.getBoundingClientRect().width)),
               lastRight: steps.length ? Math.round(steps[steps.length-1].getBoundingClientRect().right) : null,
               gridRight: Math.round(gr.right)};
  }

  // consultation fits
  const ci = document.querySelector('.ws-consultation__inner');
  if (ci) {
    out.consult = {cw: ci.clientWidth, sw: ci.scrollWidth,
                   right: Math.round(ci.getBoundingClientRect().right)};
    const sel = ci.querySelector('select');
    if (sel) out.select = {w: Math.round(sel.getBoundingClientRect().width),
                           r: Math.round(sel.getBoundingClientRect().right)};
  }

  // tap targets
  const t44 = [];
  for (const el of document.querySelectorAll('a, button, input[type=checkbox], input[type=radio]')) {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (r.height < 36 || r.width < 36) {
      t44.push({t: el.tagName + '.' + (typeof el.className === 'string' ? el.className.split(' ')[0] : ''),
                w: Math.round(r.width), h: Math.round(r.height),
                txt: (el.textContent || '').trim().slice(0, 20)});
    }
  }
  out.smallTaps = t44.slice(0, 12);

  // inner overflow (exclude marquee)
  const ov = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('.ws-partners__scroll')) continue;
    const s = getComputedStyle(el);
    if (s.display === 'none') continue;
    if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 40) {
      ov.push({t: (typeof el.className === 'string' ? el.className.slice(0, 40) : el.tagName),
               cw: el.clientWidth, sw: el.scrollWidth});
    }
  }
  out.innerOverflow = ov.slice(0, 8);
  out.docOverflow = document.documentElement.scrollWidth - vw;
  return JSON.stringify(out);
})()
"""

JS_DARK_RTL = r"""
(() => {
  const out = {};
  document.documentElement.setAttribute('data-theme', 'dark');
  document.documentElement.setAttribute('dir', 'rtl');
  document.documentElement.setAttribute('lang', 'ar');
  void document.body.offsetHeight;
  const cs = (sel) => { const e = document.querySelector(sel); if (!e) return null;
    const s = getComputedStyle(e); return {bg: s.backgroundColor, fg: s.color}; };
  out.bodyDarkRTL = cs('body');
  out.docOverflowRTL = document.documentElement.scrollWidth - window.innerWidth;
  out.heroTitle = cs('.ws-hero__title');
  out.navbarBg = getComputedStyle(document.querySelector('.ws-navbar')).backgroundColor;
  // steps still fit in RTL?
  const grid = document.querySelector('.ws-how__grid');
  if (grid) out.howRtl = {cw: grid.clientWidth, sw: grid.scrollWidth};
  const ci = document.querySelector('.ws-consultation__inner');
  if (ci) out.consultRtl = {cw: ci.clientWidth, sw: ci.scrollWidth};
  document.documentElement.setAttribute('data-theme', 'light');
  document.documentElement.setAttribute('dir', 'ltr');
  document.documentElement.setAttribute('lang', 'en');
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
for w in (320, 360, 390, 414, 768):
    send('Emulation.setDeviceMetricsOverride',
         {'width': w, 'height': 844, 'deviceScaleFactor': 1, 'mobile': w < 800})
    send('Page.navigate', {'url': TARGET})
    time.sleep(4)
    r1 = send('Runtime.evaluate', {'expression': JS, 'returnByValue': True})
    print(f'--- {w} ---')
    print(r1.get('result', {}).get('result', {}).get('value'))
    if w == 390:
        r2 = send('Runtime.evaluate', {'expression': JS_DARK_RTL, 'returnByValue': True})
        print('--- dark+rtl @390 ---')
        print(r2.get('result', {}).get('result', {}).get('value'))
ws.close()
