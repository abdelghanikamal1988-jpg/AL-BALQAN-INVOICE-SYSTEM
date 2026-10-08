"""Diagnose which header/tool elements force 402px width at 360px."""

import json
import sys
import time
import urllib.request

import websocket

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

PORT = 9333
BASE = ('file:///C:/Users/hp/OneDrive/Desktop/desktop%20298/'
        'AL%20BALQAN%20Invoice%20system/.dev/')

PAGE = sys.argv[1] if len(sys.argv) > 1 else 'preview-header.html'

JS = r"""
(() => {
  const vw = window.innerWidth;
  const rows = [];
  for (const el of document.querySelectorAll('.app-header, .app-header__inner, .app-header__inner *')) {
    const b = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || b.width < 1) continue;
    rows.push({
      cls: typeof el.className === 'string' ? el.className.slice(0, 46) : el.tagName,
      w: Math.round(b.width),
      l: Math.round(b.left),
      r: Math.round(b.right),
      sw: el.scrollWidth,
      cw: el.clientWidth,
      fs: cs.fontSize,
      txt: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 18),
    });
  }
  return JSON.stringify({vw, docSW: document.documentElement.scrollWidth, rows}, null, 1);
})()
"""


def run():
    req = urllib.request.Request(f'http://127.0.0.1:{PORT}/json')
    with urllib.request.urlopen(req, timeout=5) as r:
        ts = json.load(r)
    t = next((x for x in ts if x['type'] == 'page'), ts[0])
    ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=30)
    mid = [0]

    def send(m, p=None):
        mid[0] += 1
        ws.send(json.dumps({'id': mid[0], 'method': m, 'params': p or {}}))
        while True:
            msg = json.loads(ws.recv())
            if msg.get('id') == mid[0]:
                return msg

    send('Page.enable')
    send('Emulation.setDeviceMetricsOverride',
         {'width': 360, 'height': 844, 'deviceScaleFactor': 1, 'mobile': True})
    send('Page.navigate', {'url': BASE + PAGE})
    time.sleep(1.5)
    r = send('Runtime.evaluate', {'expression': JS, 'returnByValue': True})
    print(r['result']['result']['value'])
    ws.close()


if __name__ == '__main__':
    run()
