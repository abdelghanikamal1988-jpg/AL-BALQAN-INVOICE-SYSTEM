"""Website-route regression: same checks as audit_site_mobile.py but against
the LOCAL build (dist served on :8099) — verifies this responsive round did
not break the marketing site (theme.css tokens/clip/Cairo touch it)."""

import json
import sys
import time
import urllib.request

import websocket

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# usage: python audit_site_local.py [url]   (default: local dist build)
TARGET = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8099/dist/#/website'

JS = r"""
(() => {
  const vw = window.innerWidth;
  const out = {vw, url: location.href};
  out.wsCount = document.querySelectorAll('[class*="ws-"]').length;
  out.docOverflow = document.documentElement.scrollWidth - vw;
  const clippedAnc = (el) => {
    let p = el.parentElement;
    while (p && p !== document.body) {
      const s = getComputedStyle(p);
      if (s.overflowX === 'hidden' || s.overflowX === 'clip' ||
          s.overflowX === 'auto' || s.overflowX === 'scroll') return true;
      p = p.parentElement;
    }
    return false;
  };
  const offenders = [];
  const tiny = [];
  const small = [];
  const clipped = [];
  const els = [...document.querySelectorAll('body *')];
  for (const el of els) {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if ((r.right > vw + 1.5 || r.left < -1.5) && !clippedAnc(el)) {
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
    if (s.textOverflow !== 'ellipsis' && el.children.length === 0 &&
        (el.textContent || '').trim() &&
        el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 30 &&
        s.overflowX === 'visible' && !s.webkitLineClamp) {
      clipped.push({t: tag + '.' + (typeof el.className === 'string' ? el.className.split(' ')[0] : ''),
                    cw: el.clientWidth, sw: el.scrollWidth,
                    txt: (el.textContent || '').trim().slice(0, 24)});
    }
  }
  out.offenderCount = offenders.length;
  out.offenders = offenders.slice(0, 10);
  out.tinyCount = tiny.length;
  out.tiny = tiny.slice(0, 10);
  out.smallCount = small.length;
  out.smallText = small.slice(0, 8);
  out.clippedCount = clipped.length;
  out.clipped = clipped.slice(0, 8);
  return JSON.stringify(out);
})()
"""

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
total = 0
cases = [(360, 'ltr'), (390, 'ltr'), (414, 'ltr'), (768, 'ltr'), (1024, 'ltr'), (390, 'rtl')]
for w, direction in cases:
    send('Emulation.setDeviceMetricsOverride',
         {'width': w, 'height': 844, 'deviceScaleFactor': 1, 'mobile': w < 500})
    send('Page.navigate', {'url': TARGET})
    time.sleep(4)
    if direction == 'rtl':
        send('Runtime.evaluate', {
            'expression': "document.documentElement.dir='rtl';"
                          "document.documentElement.lang='ar';"})
        time.sleep(0.5)
    res = send('Runtime.evaluate', {'expression': JS, 'returnByValue': True})
    val = res.get('result', {}).get('result', {}).get('value')
    try:
        d = json.loads(val)
    except Exception as e:
        print(f'EVALERR {w}/{direction}: {e} {val!r}')
        continue
    probs = []
    if not d.get('wsCount'):
        probs.append('ROUTE-NOT-RENDERED (wsEls=0)')
    if d['docOverflow'] > 1:
        probs.append(f"docOverflow={d['docOverflow']}")
    if d['offenderCount']:
        probs.append(f"offenders={d['offenderCount']} {d['offenders'][:3]}")
    if d['tinyCount']:
        probs.append(f"tiny={d['tinyCount']} {d['tiny'][:3]}")
    if d['smallCount']:
        probs.append(f"smallText={d['smallCount']} {d['smallText'][:3]}")
    if d['clippedCount']:
        probs.append(f"clipped={d['clippedCount']} {d['clipped'][:3]}")
    total += (d['offenderCount'] + d['tinyCount'] + d['smallCount']
              + d['clippedCount'] + (1 if d['docOverflow'] > 1 else 0))
    status = 'OK  ' if not probs else 'FAIL'
    print(f"{status} website @{w}{'' if direction == 'ltr' else '/rtl'} "
          f"wsEls={d.get('wsCount')} " + '; '.join(probs))
print(f'\n=== total issues: {total} ===')
ws.close()
