"""Consultation Requests drill: page chrome, filters, table, detail modal —
phone widths LTR and RTL against .dev/preview-consultations.html."""

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
        const cs = getComputedStyle(e);
        if (cs.textOverflow === 'ellipsis') continue;
        if (cs.webkitLineClamp && cs.webkitLineClamp !== 'none') continue;
        const dx = e.scrollWidth - e.clientWidth;
        const dy = e.scrollHeight - e.clientHeight;
        if (dx > 2 || dy > 2) {
          clipped.push(sel + ':' + (e.className || '') + ' +' + dx + '/' + dy);
        }
      }
    }
    return clipped.slice(0, 8);
  };
  return JSON.stringify({page, clipped: scanClip('.consultations-page')});
})()"""

STATE_JS = """(() => {
  const R = (e) => { const r = e.getBoundingClientRect();
    return {w: Math.round(r.width), h: Math.round(r.height)}; };
  const tiles = [...document.querySelectorAll('.statc')];
  const sync = document.querySelector('.cs-sync');
  const toggle = document.querySelector('.filters-toggle');
  const group = document.querySelector('.cl-toolbar__group');
  const rows = [...document.querySelectorAll('.cl-table tbody tr')];
  const tds = [...document.querySelectorAll('.cl-table tbody td')];
  const badges = [...document.querySelectorAll('.cs-badge')].map((b) => b.className);
  const modal = document.querySelector('#cs-detail .modal');
  const over = JSON.parse(%s);
  return JSON.stringify({
    dir: document.documentElement.dir || 'ltr',
    lastsync: (document.querySelector('.cs-lastsync') || {}).textContent || '',
    tiles: tiles.length,
    tileLabels: tiles.map((t) => t.querySelector('.statc__label').textContent.trim()),
    tileValues: tiles.map((t) => t.querySelector('.statc__value').textContent.trim()),
    sync: sync ? R(sync) : null,
    syncText: sync ? sync.textContent.trim() : '',
    toggle: toggle ? {
      expanded: toggle.getAttribute('aria-expanded'),
      ctrl: toggle.getAttribute('aria-controls'),
      shown: getComputedStyle(toggle).display !== 'none',
      h: Math.round(toggle.getBoundingClientRect().height)} : null,
    groupCollapsed: group ? group.classList.contains('is-collapsed') : null,
    groupVisible: group ? getComputedStyle(group).display !== 'none' : null,
    search: !!document.getElementById('cs-search'),
    exportBtn: (document.querySelector('.cs-export') || {}).textContent || '',
    summary: (document.getElementById('cs-summary') || {}).textContent || '',
    rows: rows.filter((r) => getComputedStyle(r).display !== 'none').length,
    tds: tds.length,
    labelled: tds.filter((td) => td.hasAttribute('data-label')).length,
    actionsCell: document.querySelectorAll('td.actions-cell').length,
    badges,
    wa: document.querySelectorAll('.cl-table a[href^="https://wa.me/"]').length,
    mail: document.querySelectorAll('.cl-table a[href^="mailto:"]').length,
    modalShown: modal ? getComputedStyle(modal).display !== 'none' : null,
    page: over.page,
    clipped: over.clipped
  });
})()""" % OVERFLOW

FILTER_JS = """(() => {
  const set = (id, v) => {
    const el = document.getElementById(id);
    el.value = v;
    el.dispatchEvent(new Event('change', {bubbles: true}));
    el.dispatchEvent(new Event('input', {bubbles: true}));
  };
  const shown = () => [...document.querySelectorAll('.cl-table tbody tr')]
    .filter((r) => getComputedStyle(r).display !== 'none').length;
  const sum = () => document.getElementById('cs-summary').textContent;
  const out = {};
  set('cs-status-filter', 'new');
  out.statusNew = {shown: shown(), sum: sum()};
  document.getElementById('cs-clear').click();
  out.cleared = {shown: shown(), sum: sum()};
  const s = document.getElementById('cs-search');
  s.value = 'yusuf';
  s.dispatchEvent(new Event('input', {bubbles: true}));
  out.search = {shown: shown(), sum: sum()};
  document.getElementById('cs-clear').click();
  const t = document.querySelector('.filters-toggle');
  t.click();
  out.open = {
    expanded: t.getAttribute('aria-expanded'),
    collapsed: document.querySelector('.cl-toolbar__group').classList.contains('is-collapsed'),
    groupShown: getComputedStyle(document.querySelector('.cl-toolbar__group')).display !== 'none'};
  t.click();
  out.close = {
    expanded: t.getAttribute('aria-expanded'),
    collapsed: document.querySelector('.cl-toolbar__group').classList.contains('is-collapsed')};
  return JSON.stringify(out);
})()"""

MODAL_OPEN_JS = """new Promise((resolve) => {
  const R = (e) => { const r = e.getBoundingClientRect();
    return {x: Math.round(r.x), y: Math.round(r.y),
            w: Math.round(r.width), h: Math.round(r.height)}; };
  const overlay = document.getElementById('cs-detail');
  document.querySelector('[data-detail]').click();
  setTimeout(() => {
    const modal = overlay.querySelector('.modal');
    const cs = getComputedStyle(modal);
    const ocs = getComputedStyle(overlay);
    const close = modal.querySelector('.modal__close');
    const dts = [...modal.querySelectorAll('.cs-detail__row dt')].map((d) => d.textContent.trim());
    const status = modal.querySelector('#cs-detail-status');
    const notes = modal.querySelector('#cs-detail-notes');
    status.value = 'done';
    const over = JSON.parse(%s);
    resolve(JSON.stringify({
      overlayPos: ocs.position,
      overlayDisplay: ocs.display,
      modalDisplay: cs.display,
      box: R(modal),
      atBottom: Math.abs(modal.getBoundingClientRect().bottom - window.innerHeight) < 2,
      closeShown: close ? getComputedStyle(close).display !== 'none' : null,
      closeBox: close ? R(close) : null,
      dtCount: dts.length,
      hasCompany: dts.includes('Company'),
      statusValue: status.value,
      statusBox: R(status),
      notesBox: notes ? R(notes) : null,
      wa: !!modal.querySelector('a[href^="https://wa.me/"]'),
      mail: !!modal.querySelector('a[href^="mailto:"]'),
      saveBox: R(modal.querySelector('.modal__actions .btn--primary')),
      page: over.page,
      clipped: over.clipped
    }));
  }, 450);
})""" % OVERFLOW

CLOSE_JS = """(() => {
  const overlay = document.getElementById('cs-detail');
  overlay.querySelector('.modal__close').click();
  const modal = overlay.querySelector('.modal');
  return JSON.stringify({
    overlay: getComputedStyle(overlay).display,
    modal: getComputedStyle(modal).display});
})()"""

cmd('Page.enable')
cmd('Runtime.enable')

for rtl in (False, True):
    for w in (360, 390, 414):
        cmd('Emulation.setDeviceMetricsOverride',
            {'width': w, 'height': 844, 'deviceScaleFactor': 1, 'mobile': True})
        tag = '%dpx%s' % (w, '/rtl' if rtl else '')

        cmd('Page.navigate', {'url': page_url('preview-consultations.html')})
        time.sleep(1.6)
        if rtl:
            js("document.documentElement.dir = 'rtl'")
            time.sleep(0.3)

        d = json.loads(js(STATE_JS))
        check('%s page: rtl mirror' % tag, d['dir'] == ('rtl' if rtl else 'ltr'), d['dir'])
        check('%s page: 5 tiles (24/9/6/7/2)' % tag,
              d['tiles'] == 5 and d['tileValues'] == ['24', '9', '6', '7', '2'],
              (d['tileLabels'], d['tileValues']))
        check('%s page: last-sync line' % tag, 'Last sync' in d['lastsync'], d['lastsync'])
        check('%s page: sync button >=44' % tag,
              d['sync'] and d['sync']['h'] >= 44 and d['sync']['w'] >= 40
              and 'Sync' in d['syncText'], d['sync'])
        check('%s page: filters toggle collapsed + aria' % tag,
              d['toggle'] and d['toggle']['expanded'] == 'false'
              and d['toggle']['ctrl'] == 'cs-filters'
              and d['toggle']['shown'] and d['toggle']['h'] >= 44
              and d['groupCollapsed'] and not d['groupVisible'], d['toggle'])
        check('%s table: 6 rows, 42/42 labelled, actions-cell' % tag,
              d['rows'] == 6 and d['tds'] == 42 and d['labelled'] == 42
              and d['actionsCell'] == 6, (d['rows'], d['tds'], d['labelled']))
        check('%s table: badge mix 2/2/1/1' % tag,
              sum('cs-badge--new' in b for b in d['badges']) == 2
              and sum('cs-badge--in_progress' in b for b in d['badges']) == 2
              and sum('cs-badge--done' in b for b in d['badges']) == 1
              and sum('cs-badge--archived' in b for b in d['badges']) == 1,
              d['badges'])
        check('%s table: 5 wa.me + 5 mailto' % tag,
              d['wa'] == 5 and d['mail'] == 5, (d['wa'], d['mail']))
        check('%s table: search/export/summary' % tag,
              d['search'] and 'Export CSV' in d['exportBtn']
              and d['summary'].strip() == '6 of 6', d['summary'])
        check('%s page: no clipped text' % tag, d['clipped'] == [], d['clipped'])
        check('%s page: no overflow' % tag, d['page'] <= 1, d['page'])

        f = json.loads(js(FILTER_JS))
        check('%s filter: status=new -> 2 of 6' % tag,
              f['statusNew']['shown'] == 2 and f['statusNew']['sum'] == '2 of 6', f['statusNew'])
        check('%s filter: clear -> 6 of 6' % tag,
              f['cleared']['shown'] == 6 and f['cleared']['sum'] == '6 of 6', f['cleared'])
        check('%s filter: search yusuf -> 1 row' % tag,
              f['search']['shown'] == 1 and f['search']['sum'] == '1 of 6', f['search'])
        check('%s filter: toggle expands + collapses group' % tag,
              f['open']['expanded'] == 'true' and not f['open']['collapsed']
              and f['open']['groupShown']
              and f['close']['expanded'] == 'false' and f['close']['collapsed'], f)

        m = json.loads(js(MODAL_OPEN_JS))
        check('%s modal: open on fixed overlay' % tag,
              m['overlayPos'] == 'fixed' and m['overlayDisplay'] == 'flex'
              and m['modalDisplay'] != 'none', m['overlayPos'])
        check('%s modal: fits viewport + sheet bottom' % tag,
              m['box']['x'] >= -1 and m['box']['x'] + m['box']['w'] <= w + 1
              and m['box']['y'] >= -1 and m['atBottom'], m['box'])
        check('%s modal: close visible + tap target' % tag,
              m['closeShown'] and m['closeBox']['h'] >= 40 and m['closeBox']['w'] >= 40,
              m['closeBox'])
        check('%s modal: raw fields >=8 + Company' % tag,
              m['dtCount'] >= 8 and m['hasCompany'], m['dtCount'])
        check('%s modal: status select reacts' % tag,
              m['statusValue'] == 'done' and m['statusBox']['h'] >= 40, m['statusBox'])
        check('%s modal: notes usable + actions' % tag,
              m['notesBox'] and m['notesBox']['h'] >= 60 and m['saveBox']['h'] >= 40,
              (m['notesBox'], m['saveBox']))
        check('%s modal: whatsapp + mailto' % tag, m['wa'] and m['mail'], (m['wa'], m['mail']))
        check('%s modal: no clipped text' % tag, m['clipped'] == [], m['clipped'])
        check('%s modal: no overflow' % tag, m['page'] <= 1, m['page'])

        c = json.loads(js(CLOSE_JS))
        check('%s modal: closes' % tag,
              c['overlay'] == 'none' and c['modal'] == 'none', c)

ws.close()
print()
print('TOTAL FAILS:', len(fails), fails)
