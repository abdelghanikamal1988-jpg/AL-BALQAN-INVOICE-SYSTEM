"""Verify the Application pipeline funnel card: full-width span, 6 stages,
no overflow, no clipped text, on phone widths LTR and RTL."""

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


MEASURE = """(() => {
  const R = (e) => { const r = e.getBoundingClientRect();
    return {w: Math.round(r.width), h: Math.round(r.height)}; };
  const wide = document.querySelector('.db-chart-card--wide');
  const charts = document.querySelector('.db-charts');
  const cards = [...document.querySelectorAll('.db-charts > .db-chart-card')];
  const grid = document.querySelector('.db-grid');
  const act = document.querySelector('.db-panel--full');
  const stages = [...document.querySelectorAll('.db-funnel__stage')];
  const over = (e) => [...e.querySelectorAll('*')].concat([e])
    .filter((x) => x.scrollWidth - x.clientWidth > 1 || x.scrollHeight - x.clientHeight > 1)
    .map((x) => (x.className || x.tagName) + '+' + (x.scrollWidth - x.clientWidth)
         + '/' + (x.scrollHeight - x.clientHeight));
  return JSON.stringify({
    dir: document.documentElement.dir || 'ltr',
    wide: wide ? R(wide) : null,
    charts: charts ? R(charts).w : 0,
    cardWidths: cards.map((c) => R(c).w),
    grid: grid ? R(grid).w : 0,
    gridKids: grid ? grid.children.length : -1,
    act: act ? R(act) : null,
    funnel: document.querySelector('.db-funnel') ? R(document.querySelector('.db-funnel')) : null,
    stages: stages.map((s) => ({
      name: (s.querySelector('.db-funnel__name') || {}).textContent.trim(),
      val: (s.querySelector('.db-funnel__val') || {}).textContent.trim(),
      track: R(s.querySelector('.db-funnel__track')).w,
      fill: Math.round((s.querySelector('.db-funnel__fill') || {getBoundingClientRect: () => ({width: 0})}).getBoundingClientRect().width),
      step: (s.querySelector('.db-funnel__step') || {}).textContent.trim(),
      over: over(s)
    })),
    foot: document.querySelector('.db-chart-card--wide .db-chart-card__foot')
      ? over(document.querySelector('.db-chart-card--wide .db-chart-card__foot')) : null,
    page: document.documentElement.scrollWidth - document.documentElement.clientWidth
  });
})()"""

cmd('Page.enable')
cmd('Runtime.enable')

for rtl in (False, True):
    for w in (360, 390, 414):
        cmd('Emulation.setDeviceMetricsOverride',
            {'width': w, 'height': 844, 'deviceScaleFactor': 1, 'mobile': True})
        cmd('Page.navigate', {'url': URL})
        time.sleep(2.5)
        if rtl:
            js("document.documentElement.dir = 'rtl'")
            time.sleep(0.4)
        tag = '%dpx%s' % (w, '/rtl' if rtl else '')
        d = json.loads(js(MEASURE))
        check('%s funnel card present (6 stages)' % tag,
              d['wide'] is not None and len(d['stages']) == 6,
              d['wide'])
        check('%s funnel card spans charts grid' % tag,
              d['wide'] is not None and abs(d['wide']['w'] - d['charts']) <= 2,
              'card=%s grid=%s' % (d['wide']['w'] if d['wide'] else None, d['charts']))
        if d['wide']:
            others = [x for i, x in enumerate(d['cardWidths']) if d['wide']['w'] == x]
            check('%s funnel card is wider than siblings' % tag,
                  d['wide']['w'] >= max([x for x in d['cardWidths'] if x != d['wide']['w']] or [0]),
                  d['cardWidths'])
        check('%s recent activity spans grid' % tag,
              d['act'] is not None and d['gridKids'] == 1
              and abs(d['act']['w'] - d['grid']) <= 2,
              'act=%s grid=%s kids=%s' % (d['act'], d['grid'], d['gridKids']))
        check('%s stage bars have track width' % tag,
              all(s['track'] >= 70 for s in d['stages']),
              [s['track'] for s in d['stages']])
        check('%s stage text fully visible' % tag,
              all(not s['over'] for s in d['stages']),
              [(s['name'][:12], s['over']) for s in d['stages'] if s['over']])
        check('%s stage values non-empty' % tag,
              all(s['name'] and s['val'] and s['step'] for s in d['stages']),
              [(s['name'], s['val'], s['step']) for s in d['stages']])
        check('%s foot figures visible' % tag, d['foot'] == [], d['foot'])
        check('%s no page overflow' % tag, d['page'] <= 1, d['page'])

ws.close()
print()
print('TOTAL FAILS:', len(fails), fails)
