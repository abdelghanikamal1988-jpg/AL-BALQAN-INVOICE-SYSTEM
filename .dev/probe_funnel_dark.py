"""Dark-mode colour probe for the pipeline funnel (fills must not vanish)."""

import json
import time
import urllib.parse
import urllib.request

import websocket

PORT = 9333
ROOT = (r'C:\Users\hp\OneDrive\Desktop\desktop 298\AL BALQAN Invoice system'
        r'\.dev')
URL = 'file:///' + urllib.parse.quote((ROOT + r'\preview-dashboard.html').replace('\\', '/'), safe='/:')

fails = []


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


def js(expr):
    r = cmd('Runtime.evaluate',
            {'expression': expr, 'returnByValue': True, 'awaitPromise': True})
    if 'exceptionDetails' in r:
        return {'ERROR': r['exceptionDetails'].get('text')}
    return r.get('result', {}).get('value')


def check(name, cond, detail=''):
    print(('PASS ' if cond else 'FAIL ') + name + (' | ' + str(detail) if detail else ''))
    if not cond:
        fails.append(name)


PROBE = """(() => {
  const page = getComputedStyle(document.body).backgroundColor;
  const rows = [...document.querySelectorAll('.db-funnel__stage')].map((s) => ({
    name: s.querySelector('.db-funnel__name').textContent.trim(),
    fill: getComputedStyle(s.querySelector('.db-funnel__fill')).backgroundColor,
    stepBg: getComputedStyle(s.querySelector('.db-funnel__step')).backgroundColor,
    stepFg: getComputedStyle(s.querySelector('.db-funnel__step')).color,
    track: getComputedStyle(s.querySelector('.db-funnel__track')).backgroundColor
  }));
  return JSON.stringify({page, rows});
})()"""

cmd('Page.enable')
cmd('Runtime.enable')
cmd('Emulation.setDeviceMetricsOverride',
    {'width': 390, 'height': 844, 'deviceScaleFactor': 1, 'mobile': True})
cmd('Page.navigate', {'url': URL})
time.sleep(2.5)

for theme in ('light', 'dark'):
    js("document.documentElement.dataset.theme = '%s'" % theme)
    time.sleep(0.5)
    d = json.loads(js(PROBE))
    print('\n=== ' + theme + ' | page ' + d['page'])
    for r in d['rows']:
        print('  %-20s fill=%-20s stepBg=%-24s stepFg=%s' % (
            r['name'], r['fill'], r['stepBg'], r['stepFg']))
        check('%s %s fill opaque' % (theme, r['name']),
              r['fill'].startswith('rgb(') and not r['fill'].endswith('0)'), r['fill'])
        check('%s %s step chip tinted' % (theme, r['name']),
              r['stepBg'].startswith('rgba(') or r['stepBg'] != r['page'], r['stepBg'])

ws.close()
print()
print('TOTAL FAILS:', len(fails), fails)
