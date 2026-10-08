import json
import sys
import time
import urllib.request

import websocket

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

TARGET = ("https://abdelghanikamal1988-jpg.github.io/AL-BALQAN-INVOICE-SYSTEM/#/website")

JS = r"""
(() => {
  const vw = window.innerWidth;
  const out = {vw, url: location.href};
  out.docOverflow = document.documentElement.scrollWidth - vw;
  const offenders = [];
  const tiny = [];
  const small = [];
  const els = [...document.querySelectorAll('body *')];
  for (const el of els) {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (r.right > vw + 1.5 || r.left < -1.5) {
      offenders.push({t: el.tagName + '.' + (typeof el.className === 'string' ? el.className.split(' ')[0] : ''),
                      l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width)});
    }
    const tag = el.tagName;
    if ((tag === 'A' || tag === 'BUTTON' || el.getAttribute('role') === 'button') &&
        r.height > 0 && r.height < 36 && r.width > 0) {
      tiny.push({t: tag + '.' + (typeof el.className === 'string' ? el.className.split(' ')[0] : ''),
                 w: Math.round(r.width), h: Math.round(r.height),
                 txt: (el.textContent || '').trim().slice(0, 24)});
    }
    const fs = parseFloat(s.fontSize);
    if (el.children.length === 0 && (el.textContent || '').trim() && fs > 0 && fs < 11) {
      small.push({t: tag + '.' + (typeof el.className === 'string' ? el.className.split(' ')[0] : ''),
                  fs, txt: (el.textContent || '').trim().slice(0, 24)});
    }
  }
  out.offenders = offenders.slice(0, 25);
  out.offenderCount = offenders.length;
  out.tiny = tiny.slice(0, 20);
  out.tinyCount = tiny.length;
  out.smallText = small.slice(0, 15);
  out.smallCount = small.length;
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
for w in (360, 390, 414, 768):
    send('Emulation.setDeviceMetricsOverride',
         {'width': w, 'height': 800, 'deviceScaleFactor': 1, 'mobile': w < 500})
    send('Page.navigate', {'url': TARGET})
    time.sleep(4)
    res = send('Runtime.evaluate', {'expression': JS, 'returnByValue': True})
    val = res.get('result', {}).get('result', {}).get('value')
    print(f'===== width {w} =====')
    print(val)
ws.close()
