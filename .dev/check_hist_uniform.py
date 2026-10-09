"""Acceptance check for the clients / invoice-history stacked cards:
every row (card) of a table must be exactly as tall as its siblings, and no
cell may clip content (a deliberate .cell-v / line-clamp ellipsis is allowed)."""

import json
import sys
import time
import urllib.parse
import urllib.request

import websocket

PORT = 9333
ROOT = (r'C:\Users\hp\OneDrive\Desktop\desktop 298\AL BALQAN Invoice system'
        r'\.dev')
PAGES = ['preview-clients.html', 'preview-history.html', 'preview-hist-test.html',
         'preview-detail.html']
TABLES = ['.cl-table', '.history-table']
WIDTHS = [360, 390, 414]


def new_target(url):
    req = urllib.request.Request(
        'http://localhost:%d/json/new?%s' % (PORT, urllib.parse.quote(url, safe='')),
        method='PUT')
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.load(r)


t = new_target('about:blank')
ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=60)
mid = [0]


def cmd(method, params=None):
    mid[0] += 1
    i = mid[0]
    ws.send(json.dumps({'id': i, 'method': method, 'params': params or {}}))
    while True:
        m = json.loads(ws.recv())
        if m.get('id') == i:
            return m.get('result', {})


def js(expr, wait=0):
    if wait:
        time.sleep(wait)
    r = cmd('Runtime.evaluate',
            {'expression': expr, 'returnByValue': True, 'awaitPromise': True})
    if 'exceptionDetails' in r:
        return {'ERROR': r['exceptionDetails'].get('text')}
    return r.get('result', {}).get('value')


MEASURE = """(() => {
  const out = [];
  for (const sel of %s) {
    for (const t of document.querySelectorAll(sel)) {
      const rows = [...t.querySelectorAll('tbody tr')];
      if (!rows.length) continue;
      const hs = rows.map((r) => Math.round(r.getBoundingClientRect().height));
      const bad = [];
      const walk = (el, row) => {
        const cs = getComputedStyle(el);
        const clamp = cs.webkitLineClamp && cs.webkitLineClamp !== 'none';
        if (el.scrollWidth - el.clientWidth > 1 && cs.textOverflow !== 'ellipsis' && !clamp) {
          bad.push('W ' + el.tagName + '.' + el.className + ' +' + (el.scrollWidth - el.clientWidth)
                   + ' :: ' + el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 26));
        }
        if (el.scrollHeight - el.clientHeight > 1 && !clamp) {
          bad.push('H ' + el.tagName + '.' + el.className + ' +' + (el.scrollHeight - el.clientHeight)
                   + ' :: ' + el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 26));
        }
        for (const c of el.children) walk(c, row);
      };
      rows.forEach((r, i) => walk(r, i));
      out.push({cls: t.className, n: rows.length, hs: hs,
                spread: Math.max(...hs) - Math.min(...hs), bad: bad.slice(0, 8)});
    }
  }
  return JSON.stringify(out);
})()"""

cmd('Page.enable')
cmd('Runtime.enable')

fails = []
for width in WIDTHS:
    for rtl in (False, True):
        cmd('Emulation.setDeviceMetricsOverride',
            {'width': width, 'height': 844, 'deviceScaleFactor': 1, 'mobile': True})
        for page in PAGES:
            url = 'file:///' + urllib.parse.quote(
                (ROOT + '\\' + page).replace('\\', '/'), safe='/:')
            cmd('Page.navigate', {'url': url})
            time.sleep(2.5)
            cmd('Runtime.evaluate',
                {'expression': "document.documentElement.dir='%s'" % ('rtl' if rtl else 'ltr')})
            time.sleep(0.4)
            for r in json.loads(js(MEASURE % json.dumps(TABLES))):
                tag = '%s %-18s @%d%s' % (page.replace('.html', '').ljust(20),
                                          r['cls'], width, '/rtl' if rtl else '')
                if r['spread']:
                    fails.append('%s non-uniform spread=%d %s' % (tag, r['spread'], r['hs']))
                    print('FAIL %-46s spread=%-3d %s' % (tag, r['spread'], r['hs']))
                elif r['bad']:
                    fails.append('%s clipped %s' % (tag, r['bad']))
                    print('FAIL %-46s clipped: %s' % (tag, r['bad']))
                else:
                    print('PASS %-46s %d cards h=%s' % (tag, r['n'], r['hs']))

ws.close()
print('\nTOTAL FAILS: %d' % len(fails))
for f in fails:
    print('  -', f)
sys.exit(1 if fails else 0)
