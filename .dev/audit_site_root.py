import json
import sys
import time
import urllib.request

import websocket

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

TARGET = ("http://localhost:5173/#/website")

JS = r"""
(() => {
  const out = {};
  const scan = (sel) => {
    const root = document.querySelector(sel);
    if (!root) return null;
    const res = [];
    const rr = root.getBoundingClientRect();
    res.push({t: 'ROOT ' + sel, cw: root.clientWidth, sw: root.scrollWidth, l: Math.round(rr.left), r: Math.round(rr.right)});
    for (const el of root.querySelectorAll('*')) {
      const s = getComputedStyle(el);
      if (s.display === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2) continue;
      if (r.right > rr.right + 1 || el.scrollWidth > el.clientWidth + 2) {
        res.push({t: el.tagName + '.' + (typeof el.className === 'string' ? el.className.slice(0, 44) : ''),
                  l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width),
                  cw: el.clientWidth, sw: el.scrollWidth,
                  minW: s.minWidth, wid: s.width});
      }
    }
    return res.slice(0, 25);
  };
  out.consult = scan('.ws-consultation__inner');
  out.how = scan('.ws-how__grid');
  // hamburger detail
  const tog = document.querySelector('.ws-navbar__toggle');
  if (tog) {
    const r = tog.getBoundingClientRect();
    const h = document.querySelector('.ws-navbar__hamburger');
    const hr = h ? h.getBoundingClientRect() : null;
    out.toggle = {w: Math.round(r.width), h: Math.round(r.height),
                  pad: getComputedStyle(tog).padding,
                  ham: hr ? {w: Math.round(hr.width), h: Math.round(hr.height)} : null,
                  hamStyle: h ? {h: getComputedStyle(h).height, w: getComputedStyle(h).width} : null};
  }
  // explore link detail
  const ex = document.querySelector('.ws-explore-link');
  if (ex) {
    const s = getComputedStyle(ex);
    out.explore = {h: Math.round(ex.getBoundingClientRect().height), pad: s.padding, fs: s.fontSize,
                   box: s.boxSizing, display: s.display};
  }
  // form rows
  const fr = document.querySelector('.ws-form-row');
  if (fr) out.formRow = {cols: getComputedStyle(fr).gridTemplateColumns, w: Math.round(fr.getBoundingClientRect().width)};
  const fg = document.querySelectorAll('.ws-form-group');
  out.formGroups = [...fg].slice(0, 6).map(e => ({w: Math.round(e.getBoundingClientRect().width),
    minW: getComputedStyle(e).minWidth, inp: (i => i ? Math.round(i.getBoundingClientRect().width) : null)(e.querySelector('input,select,textarea'))}));
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
send('Emulation.setDeviceMetricsOverride',
     {'width': 360, 'height': 844, 'deviceScaleFactor': 1, 'mobile': True})
send('Page.navigate', {'url': TARGET})
time.sleep(4.5)
res = send('Runtime.evaluate', {'expression': JS, 'returnByValue': True})
val = res.get('result', {}).get('result', {}).get('value')
print(json.dumps(json.loads(val), indent=1))
ws.close()
