"""Diagnose audit MODAL failures on preview-consultations.html.

Forces the overlays exactly like audit_mobile_v2.py, then measures .modal
rects immediately and again after animations settle.
"""
import json
import time
import urllib.parse
import urllib.request

import websocket

PORT = 9333
ROOT = (r'C:\Users\hp\OneDrive\Desktop\desktop 298\AL BALQAN Invoice system'
        r'\.dev')
PAGE = 'preview-consultations.html'


def page_url(name):
    return 'file:///' + urllib.parse.quote((ROOT + '\\' + name).replace('\\', '/'), safe='/:')


req = urllib.request.Request(
    'http://localhost:%d/json/new?%s' % (PORT, urllib.parse.quote(page_url(PAGE), safe='')),
    method='PUT')
with urllib.request.urlopen(req, timeout=10) as r:
    target = json.load(r)
ws = websocket.create_connection(target['webSocketDebuggerUrl'], timeout=60)
mid = [0]


def cmd(method, params=None):
    mid[0] += 1
    i = mid[0]
    ws.send(json.dumps({'id': i, 'method': method, 'params': params or {}}))
    while True:
        m = json.loads(ws.recv())
        if m.get('id') == i:
            return m.get('result', {})


def js(expr):
    r = cmd('Runtime.evaluate',
            {'expression': expr, 'returnByValue': True, 'awaitPromise': True})
    if 'exceptionDetails' in r:
        return {'ERROR': r['exceptionDetails'].get('text')}
    return r.get('result', {}).get('value')


MEASURE = """(() => {
  const modals = [...document.querySelectorAll('.modal')].map((m) => {
    const cs = getComputedStyle(m);
    const b = m.getBoundingClientRect();
    const ov = m.parentElement;
    return {
      cls: m.className,
      display: cs.display,
      anim: cs.animationName,
      transform: cs.transform === 'none' ? 'none' : cs.transform,
      w: Math.round(b.width), h: Math.round(b.height),
      left: Math.round(b.left), bottom: Math.round(b.bottom),
      ovPos: ov ? getComputedStyle(ov).position : '?',
      ovDisplay: ov ? getComputedStyle(ov).display : '?',
    };
  });
  return JSON.stringify({vh: window.innerHeight, modals}, null, 1);
})()"""

FORCE = """(() => {
  for (const ov of document.querySelectorAll('.modal-overlay')) {
    const st = ov.getAttribute('style') || '';
    if (!st.includes('position: static')) continue;
    ov.style.setProperty('position', 'fixed', 'important');
    ov.style.setProperty('inset', '0', 'important');
    ov.style.setProperty('display', 'flex', 'important');
  }
  return 'forced';
})()"""

for w in (360, 768, 1024):
    cmd('Emulation.setDeviceMetricsOverride',
        {'width': w, 'height': 844, 'deviceScaleFactor': 1, 'mobile': w <= 414})
    cmd('Page.navigate', {'url': page_url(PAGE)})
    time.sleep(1.6)
    print('=== width', w, 'BEFORE force ===')
    print(js(MEASURE))
    print(js(FORCE))
    print('--- after force (immediate) ---')
    print(js(MEASURE))
    time.sleep(0.8)
    print('--- after 800ms ---')
    print(js(MEASURE))
    print()

ws.close()
