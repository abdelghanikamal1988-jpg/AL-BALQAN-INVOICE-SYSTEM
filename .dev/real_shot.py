"""Drive the REAL app at phone width: sign in, walk every route, capture
screenshots and a geometry report (overflow / clipped / overlapping boxes).

  python .dev\\real_shot.py <base> <email> <password> <outDir> [route,route,...]

Example:
  python .dev\\real_shot.py http://localhost:5173 a@b.com pass123 C:\\tmp\\shots
"""
import json
import os
import sys
import time
import base64
import urllib.request
import urllib.parse

PORT = 9333

ROUTES = [
    ('dashboard', '/'),
    ('create', '/create'),
    ('history', '/history'),
    ('clients', '/clients'),
    ('client-new', '/clients/new'),
    ('users', '/admin/users'),
    ('consultations', '/consultations'),
    ('audit', '/audit'),
    ('settings', '/settings'),
]

DIAG = r"""
(() => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const els = [...document.querySelectorAll('body *')].filter((el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });

  const escapees = [];
  const clipped = [];
  for (const el of els) {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    if (s.position !== 'fixed' && (r.right > vw + 1 || r.left < -1)) {
      escapees.push({
        sel: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''),
        l: Math.round(r.left), r: Math.round(r.right), txt: (el.textContent || '').trim().slice(0, 30),
      });
    }
    const hidX = ['hidden', 'clip'].includes(s.overflowX);
    const hidY = ['hidden', 'clip'].includes(s.overflowY);
    if ((hidX && el.scrollWidth > el.clientWidth + 1) || (hidY && el.scrollHeight > el.clientHeight + 1)) {
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (hasText) {
        clipped.push({
          sel: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''),
          sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight,
          txt: (el.textContent || '').trim().slice(0, 34),
        });
      }
    }
  }

  /* text leaves whose boxes overlap each other */
  const leaves = els.filter((el) => {
    if (el.children.length > 0) return false;
    const t = (el.textContent || '').trim();
    return t.length > 1;
  });
  const overlaps = [];
  for (let i = 0; i < leaves.length; i += 1) {
    for (let j = i + 1; j < leaves.length; j += 1) {
      const a = leaves[i], b = leaves[j];
      if (a.contains(b) || b.contains(a)) continue;
      if (a.closest('td,th') === b.closest('td,th') && a.closest('td,th')) continue;
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (ox > 3 && oy > 6) {
        overlaps.push({
          a: a.tagName.toLowerCase() + '.' + (typeof a.className === 'string' ? a.className.trim().split(/\s+/).slice(0, 2).join('.') : ''),
          b: b.tagName.toLowerCase() + '.' + (typeof b.className === 'string' ? b.className.trim().split(/\s+/).slice(0, 2).join('.') : ''),
          ox: Math.round(ox), oy: Math.round(oy),
          at: (a.textContent || '').trim().slice(0, 22),
          bt: (b.textContent || '').trim().slice(0, 22),
        });
      }
    }
  }

  return {
    vw, vh,
    docOverflow: document.documentElement.scrollWidth - vw,
    escapees: escapees.slice(0, 12),
    clipped: clipped.slice(0, 12),
    overlaps: overlaps.slice(0, 12),
    counts: { escapees: escapees.length, clipped: clipped.length, overlaps: overlaps.length },
    body: (document.querySelector('main, .page, #root') || document.body).className || '',
  };
})()
"""


def new_target(url):
    req = urllib.request.Request(
        'http://localhost:%d/json/new?%s' % (PORT, urllib.parse.quote(url, safe='')),
        method='PUT')
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.load(r)


class CDP:
    def __init__(self, url):
        import websocket
        self.t = new_target(url)
        self.ws = websocket.create_connection(self.t['webSocketDebuggerUrl'], timeout=40)
        self.mid = 0

    def cmd(self, method, params=None):
        self.mid += 1
        i = self.mid
        self.ws.send(json.dumps({'id': i, 'method': method, 'params': params or {}}))
        while True:
            m = json.loads(self.ws.recv())
            if m.get('id') == i:
                return m.get('result', {})

    def js(self, expr, wait=0):
        if wait:
            time.sleep(wait)
        r = self.cmd('Runtime.evaluate', {'expression': expr, 'returnByValue': True, 'awaitPromise': True})
        if 'exceptionDetails' in r:
            return {'ERROR': r['exceptionDetails'].get('text')}
        return r.get('result', {}).get('value')

    def shot(self, path):
        s = self.cmd('Page.captureScreenshot', {'format': 'png', 'fromSurface': True})
        with open(path, 'wb') as f:
            f.write(base64.b64decode(s['data']))

    def go(self, url, wait=4):
        self.cmd('Page.navigate', {'url': url})
        time.sleep(wait)


SET_VAL = r"""
(s, v) => {
  const el = document.querySelector(s);
  if (!el) return 'no ' + s;
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement : window.HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return 'ok';
}
"""


def main():
    base = sys.argv[1].rstrip('/')
    email = sys.argv[2]
    password = sys.argv[3]
    outdir = sys.argv[4]
    only = sys.argv[5].split(',') if len(sys.argv) > 5 and sys.argv[5] else None

    os.makedirs(outdir, exist_ok=True)
    c = CDP(base + '/')
    c.cmd('Page.enable')
    c.cmd('Runtime.enable')
    c.cmd('Emulation.setDeviceMetricsOverride', {
        'width': 390, 'height': 1700, 'deviceScaleFactor': 2, 'mobile': True,
        'screenWidth': 390, 'screenHeight': 1700,
    })
    c.go(base + '/', wait=5)

    signed_in = c.js("!!document.querySelector('.app-shell')")
    if not signed_in:
        c.js('(%s)("#login-email", %s)' % (SET_VAL, json.dumps(email)))
        c.js('(%s)("#login-password", %s)' % (SET_VAL, json.dumps(password)))
        c.js("document.querySelector('.login-form button[type=submit]')?.click()")
        for _ in range(20):
            time.sleep(1)
            if c.js("!!document.querySelector('.app-shell') || !!document.querySelector('.login-code-input')"):
                break
        mfa = c.js("!!document.querySelector('.login-code-input')")
        if mfa:
            print('MFA_REQUIRED')
            sys.exit(9)
        signed_in = c.js("!!document.querySelector('.app-shell')")
        print('signed in:', signed_in)
        if not signed_in:
            print('LOGIN_FAILED')
            c.shot(os.path.join(outdir, '_login_fail.png'))
            sys.exit(8)

    report = {}
    for name, path in ROUTES:
        if only and name not in only:
            continue
        c.go(base + '/#' + path, wait=4)
        rep = c.js(DIAG)
        report[name] = rep
        c.shot(os.path.join(outdir, name + '.png'))
        print(name, json.dumps(rep.get('counts', {})), 'docOverflow=', rep.get('docOverflow'))

    # client detail: click the first client card link
    if not only or 'client-detail' in (only or []):
        c.go(base + '/#/clients', wait=4)
        c.js("document.querySelector('a[href*=\"#/clients/\"]')?.click()")
        time.sleep(4)
        rep = c.js(DIAG)
        report['client-detail'] = rep
        c.shot(os.path.join(outdir, 'client-detail.png'))
        print('client-detail', json.dumps(rep.get('counts', {})))

    with open(os.path.join(outdir, 'report.json'), 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=1, ensure_ascii=False)
    print('WROTE', outdir)


main()
