import json
import sys
import time
import urllib.request

import websocket

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

URLS = [
    ('login', "http://localhost:5173/"),
    ('website', "http://localhost:5173/#/website"),
]

JS = r"""
(() => {
  const vw = window.innerWidth;
  const out = {vw};
  // edge padding: text/interactive elements closer than 12px to either edge
  const edge = [];
  for (const el of document.querySelectorAll('p, h1, h2, h3, a, button, span, label, div')) {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.position === 'fixed') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 30 || r.height < 10) continue;
    const txt = (el.textContent || '').trim();
    if (!txt || el.children.length > 0) continue;
    if (r.left < 8 || r.right > vw - 8) {
      edge.push({t: el.tagName + '.' + (typeof el.className === 'string' ? el.className.split(' ')[0] : ''),
                 l: Math.round(r.left), r: Math.round(r.right), txt: txt.slice(0, 30)});
    }
  }
  out.edgeIssues = edge.slice(0, 15);
  out.edgeCount = edge.length;

  // content hidden behind fixed navbar (first 72px)
  const nav = document.querySelector('.ws-navbar, .app-header');
  if (nav && getComputedStyle(nav).position === 'fixed') {
    const nr = nav.getBoundingClientRect();
    const hero = document.querySelector('.ws-hero');
    if (hero) {
      const hb = hero.getBoundingClientRect();
      out.behindNav = {navBottom: Math.round(nr.bottom), heroTop: Math.round(hb.top),
                       heroPadTop: getComputedStyle(hero).paddingTop};
    }
  }

  // tap targets < 44px for interactive
  const t44 = [];
  for (const el of document.querySelectorAll('a, button, input, select, [role=button]')) {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (r.height < 40 || r.width < 40) {
      t44.push({t: el.tagName + '.' + (typeof el.className === 'string' ? el.className.split(' ')[0] : ''),
                w: Math.round(r.width), h: Math.round(r.height),
                txt: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 22)});
    }
  }
  out.smallTaps = t44.slice(0, 20);
  out.smallTapCount = t44.length;

  // inner overflow (non-marquee)
  const ov = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('.ws-partners__scroll')) continue;
    const s = getComputedStyle(el);
    if (s.display === 'none') continue;
    if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 40) {
      ov.push({t: el.tagName + '.' + (typeof el.className === 'string' ? el.className.slice(0, 40) : ''),
               cw: el.clientWidth, sw: el.scrollWidth});
    }
  }
  out.innerOverflow = ov.slice(0, 15);

  // gap analysis between sibling cards (should be consistent)
  const grid = document.querySelector('.ws-services__grid, .ws-destinations__grid, .ws-how__grid');
  if (grid) {
    const kids = [...grid.children];
    const rects = kids.map(k => k.getBoundingClientRect());
    out.grid = {cols: getComputedStyle(grid).gridTemplateColumns,
                gaps: rects.length > 1 ? Math.round(rects[1].left - rects[0].right) : null,
                cardW: rects.map(r => Math.round(r.width))};
  }
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
for name, url in URLS:
    for w in (360, 390):
        send('Emulation.setDeviceMetricsOverride',
             {'width': w, 'height': 844, 'deviceScaleFactor': 1, 'mobile': True})
        send('Page.navigate', {'url': url})
        time.sleep(4)
        res = send('Runtime.evaluate', {'expression': JS, 'returnByValue': True})
        val = res.get('result', {}).get('result', {}).get('value')
        print(f'########## {name} @ {w} ##########')
        print(json.dumps(json.loads(val), indent=1))
ws.close()
