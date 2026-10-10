"""Round 1 drill: settings form, dashboard onboarding card, clients passport
expiry alert, history WhatsApp button — phone widths LTR and RTL."""

import json
import time
import urllib.parse
import urllib.request

import websocket

PORT = 9333
ROOT = (r'C:\Users\hp\OneDrive\Desktop\desktop 298\AL BALQAN Invoice system'
        r'\.dev')

fails = []


def page_url(name):
    return 'file:///' + urllib.parse.quote((ROOT + '\\' + name).replace('\\', '/'), safe='/:')


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


OVERFLOW = """(() => {
  const page = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  const scanClip = (rootSel) => {
    const root = document.querySelector(rootSel);
    if (!root) return ['no-root:' + rootSel];
    const clipped = [];
    for (const sel of ['BUTTON', 'A', 'H1', 'H2', 'SPAN', 'B']) {
      for (const e of root.querySelectorAll(sel)) {
        if (e.children.length > 0) continue;
        const dx = e.scrollWidth - e.clientWidth;
        const dy = e.scrollHeight - e.clientHeight;
        if (dx > 2 || dy > 2) {
          clipped.push(sel + ':' + (e.className || '') + ' +' + dx + '/' + dy);
        }
      }
    }
    return clipped.slice(0, 8);
  };
  return JSON.stringify({page,
    clippedSettings: scanClip('.settings-page'),
    clippedOnboard: scanClip('.db-onboard'),
    clippedExpiry: scanClip('.cl-expiry'),
    clippedHistory: scanClip('.history-table')});
})()"""

SETTINGS_JS = """(() => {
  const R = (e) => { const r = e.getBoundingClientRect();
    return {w: Math.round(r.width), h: Math.round(r.height)}; };
  const ids = ['set-companyName','set-legalName','set-licenseNo','set-trn','set-phone',
               'set-email','set-website','set-city','set-address','set-country',
               'set-vatRate','set-invoicePrefix','set-currency','set-terms','set-bankDetails'];
  const missing = ids.filter((i) => !document.getElementById(i));
  const form = document.getElementById('settings-form');
  const cards = [...document.querySelectorAll('.settings-form .card')];
  const actions = document.querySelector('.settings-actions');
  const save = document.querySelector('.settings-actions [type=submit]');
  const reset = document.querySelector('.settings-actions .btn--neutral');
  const ta = [...document.querySelectorAll('.settings-form textarea')];
  const over = JSON.parse(%s);
  return JSON.stringify({
    dir: document.documentElement.dir || 'ltr',
    missing,
    form: !!form,
    cards: cards.length,
    actions: actions ? R(actions) : null,
    save: save ? R(save) : null,
    reset: reset ? R(reset) : null,
    taMin: ta.length ? Math.min(...ta.map((x) => Math.round(x.getBoundingClientRect().height))) : 0,
    page: over.page,
    clipped: over.clippedSettings
  });
})()""" % OVERFLOW

ONBOARD_JS = """(() => {
  const R = (e) => { const r = e.getBoundingClientRect();
    return {w: Math.round(r.width), h: Math.round(r.height)}; };
  const card = document.querySelector('.db-onboard');
  const steps = [...document.querySelectorAll('.db-onboard__step')];
  const done = document.querySelectorAll('.db-onboard__step.is-done').length;
  const bar = document.querySelector('.db-onboard__bar span');
  const dismiss = document.querySelector('.db-onboard .icon-btn');
  const progress = document.querySelector('.db-onboard__progress');
  const over = JSON.parse(%s);
  return JSON.stringify({
    card: card ? R(card) : null,
    steps: steps.length,
    done,
    barW: bar ? Math.round(bar.getBoundingClientRect().width) : 0,
    barBox: document.querySelector('.db-onboard__bar')
      ? Math.round(document.querySelector('.db-onboard__bar').getBoundingClientRect().width) : 0,
    dismiss: dismiss ? R(dismiss) : null,
    progress: progress ? progress.textContent.trim() : '',
    page: over.page,
    clipped: over.clippedOnboard
  });
})()""" % OVERFLOW

EXPIRY_JS = """(() => {
  const R = (e) => { const r = e.getBoundingClientRect();
    return {w: Math.round(r.width), h: Math.round(r.height)}; };
  const panel = document.querySelector('.cl-expiry');
  const items = [...document.querySelectorAll('.cl-expiry__item')];
  const urgent = document.querySelectorAll('.cl-expiry__item--urgent').length;
  const chips = [...document.querySelectorAll('.cl-expiry__chip')].map((c) => c.textContent.trim());
  const over = JSON.parse(%s);
  return JSON.stringify({
    panel: panel ? R(panel) : null,
    items: items.length,
    urgent,
    chips,
    tapMin: items.length ? Math.min(...items.map((i) => Math.round(i.querySelector('.cl-expiry__link').getBoundingClientRect().height))) : 0,
    page: over.page,
    clipped: over.clippedExpiry
  });
})()""" % OVERFLOW

WA_JS = """(() => {
  const btns = [...document.querySelectorAll('.btn--whatsapp')];
  const over = JSON.parse(%s);
  return JSON.stringify({
    n: btns.length,
    labels: btns.map((b) => b.textContent.trim()),
    aria: btns.map((b) => b.getAttribute('aria-label')),
    page: over.page
  });
})()""" % OVERFLOW

cmd('Page.enable')
cmd('Runtime.enable')

for rtl in (False, True):
    for w in (360, 390, 414):
        cmd('Emulation.setDeviceMetricsOverride',
            {'width': w, 'height': 844, 'deviceScaleFactor': 1, 'mobile': True})
        tag = '%dpx%s' % (w, '/rtl' if rtl else '')

        cmd('Page.navigate', {'url': page_url('preview-settings.html')})
        time.sleep(1.6)
        if rtl:
            js("document.documentElement.dir = 'rtl'")
            time.sleep(0.3)
        d = json.loads(js(SETTINGS_JS))
        check('%s settings: 15 fields + form + 3 cards' % tag,
              d['missing'] == [] and d['form'] and d['cards'] == 3, d['missing'])
        check('%s settings: save + reset actions visible' % tag,
              d['save'] and d['save']['h'] >= 30 and d['reset'] and d['reset']['h'] >= 30,
              (d['save'], d['reset']))
        check('%s settings: textareas usable height' % tag, d['taMin'] >= 80, d['taMin'])
        check('%s settings: no clipped text' % tag, d['clipped'] == [], d['clipped'])
        check('%s settings: no page overflow' % tag, d['page'] <= 1, d['page'])

        cmd('Page.navigate', {'url': page_url('preview-dashboard.html')})
        time.sleep(1.8)
        if rtl:
            js("document.documentElement.dir = 'rtl'")
            time.sleep(0.3)
        d = json.loads(js(ONBOARD_JS))
        check('%s onboard: card with 4 steps' % tag,
              d['card'] is not None and d['steps'] == 4, d)
        check('%s onboard: progress 1/4 + bar width' % tag,
              d['done'] == 1 and '1 of 4' in d['progress']
              and d['barW'] > 0 and d['barBox'] > 0,
              (d['progress'], d['barW'], d['barBox']))
        check('%s onboard: dismiss tap target' % tag,
              d['dismiss'] and d['dismiss']['h'] >= 30, d['dismiss'])
        check('%s onboard: no clipped text' % tag, d['clipped'] == [], d['clipped'])
        check('%s onboard: no page overflow' % tag, d['page'] <= 1, d['page'])

        cmd('Page.navigate', {'url': page_url('preview-clients.html')})
        time.sleep(1.6)
        if rtl:
            js("document.documentElement.dir = 'rtl'")
            time.sleep(0.3)
        d = json.loads(js(EXPIRY_JS))
        check('%s expiry: panel with 3 items (2 urgent)' % tag,
              d['panel'] is not None and d['items'] == 3 and d['urgent'] == 2, d)
        check('%s expiry: chips readable' % tag,
              any('days' in c for c in d['chips']) and any('Expired' in c for c in d['chips']),
              d['chips'])
        check('%s expiry: rows tap-friendly' % tag, d['tapMin'] >= 40, d['tapMin'])
        check('%s expiry: no clipped text' % tag, d['clipped'] == [], d['clipped'])
        check('%s expiry: no page overflow' % tag, d['page'] <= 1, d['page'])

        cmd('Page.navigate', {'url': page_url('preview-history.html')})
        time.sleep(1.6)
        if rtl:
            js("document.documentElement.dir = 'rtl'")
            time.sleep(0.3)
        d = json.loads(js(WA_JS))
        check('%s history: whatsapp buttons present' % tag, d['n'] >= 1, d)
        check('%s history: labels + aria' % tag,
              all(x == 'WhatsApp' for x in d['labels'])
              and all(x and 'WhatsApp' in x for x in d['aria']),
              (d['labels'], d['aria']))
        check('%s history: no page overflow' % tag, d['page'] <= 1, d['page'])

ws.close()
print()
print('TOTAL FAILS:', len(fails), fails)
