"""Find which CSS rules set font-size on login/search inputs, verify
box-sizing universality, and inspect .db-bars__col element type."""

import json
import sys
import time
import urllib.request

import websocket

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

PORT = 9333
BASE = ('file:///C:/Users/hp/OneDrive/Desktop/desktop%20298/'
        'AL%20BALQAN%20Invoice%20system/.dev/')


def connect():
    req = urllib.request.Request(f'http://127.0.0.1:{PORT}/json')
    with urllib.request.urlopen(req, timeout=5) as r:
        ts = json.load(r)
    t = next((x for x in ts if x['type'] == 'page'), ts[0])
    return websocket.create_connection(t['webSocketDebuggerUrl'], timeout=30)


class CDP:
    def __init__(self):
        self.ws = connect()
        self.mid = 0

    def send(self, method, params=None):
        self.mid += 1
        self.ws.send(json.dumps({'id': self.mid, 'method': method, 'params': params or {}}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get('id') == self.mid:
                return msg

    def eval(self, expr):
        r = self.send('Runtime.evaluate', {'expression': expr, 'returnByValue': True})
        return r.get('result', {}).get('result', {}).get('value')


def main():
    c = CDP()
    c.send('Page.enable')
    c.send('Emulation.setDeviceMetricsOverride',
           {'width': 360, 'height': 844, 'deviceScaleFactor': 1, 'mobile': True})

    # ---- 1. login page: why 14px? ----
    c.send('Page.navigate', {'url': BASE + 'preview-login.html'})
    time.sleep(1.4)
    print('=== LOGIN INPUT FONT ===')
    print(c.eval("""
      (() => {
        const el = document.querySelector('input[type=email]');
        if (!el) return 'no input';
        const out = {computed: getComputedStyle(el).fontSize, cls: el.className, parent: el.parentElement.className};
        out.rules = [...document.styleSheets].flatMap(ss => {
          try { return [...ss.cssRules]; } catch(e) { return []; }
        }).filter(r => r.selectorText && (() => {
           try { return el.matches(r.selectorText); } catch(e) { return false; }
        })() && /font-size/.test(r.cssText)).map(r => r.selectorText + ' { font-size: ' + r.style.fontSize + ' }');
        return JSON.stringify(out, null, 1);
      })()
    """))
    print('=== universal box-sizing ===')
    print(c.eval("""
      (() => {
        const d = document.createElement('div');
        d.style.width = '100px'; d.style.padding = '10px'; d.style.border = '5px solid red';
        document.body.appendChild(d);
        const w = d.getBoundingClientRect().width;
        d.remove();
        const rules = [...document.styleSheets].flatMap(ss => { try { return [...ss.cssRules]; } catch(e) { return []; } })
          .filter(r => r.selectorText && /(^|,)\s*\*\s*(,|$)|\*::before/.test(r.selectorText) && /box-sizing/.test(r.cssText))
          .map(r => r.selectorText);
        return JSON.stringify({offsetWidth: w, borderBox: w === 100, universalRules: rules});
      })()
    """))
    print('=== html/body overflow ===')
    print(c.eval("""
      JSON.stringify({
        htmlOverflowX: getComputedStyle(document.documentElement).overflowX,
        bodyOverflowX: getComputedStyle(document.body).overflowX,
        docSW: document.documentElement.scrollWidth,
        innerW: window.innerWidth,
        innerH: window.innerHeight,
      })
    """))

    # ---- 2. dashboard: db-bars__col element ----
    c.send('Page.navigate', {'url': BASE + 'preview-dashboard.html'})
    time.sleep(1.4)
    print('=== DB-BARS / SECTION HINT ===')
    print(c.eval("""
      (() => {
        const bar = document.querySelector('.db-bars__col');
        const hint = document.querySelector('.db-section__hint');
        const btnsm = document.querySelector('.btn--sm');
        const d = (el) => el ? {tag: el.tagName, cls: el.className, h: Math.round(el.getBoundingClientRect().height),
                                w: Math.round(el.getBoundingClientRect().width)} : null;
        return JSON.stringify({bar: d(bar), hint: d(hint), btnsm: d(btnsm),
                               btnsmFS: btnsm ? getComputedStyle(btnsm).fontSize : null});
      })()
    """))
    print('=== TABLE WRAPPERS ===')
    print(c.eval("""
      JSON.stringify([...document.querySelectorAll('table')].map(t => ({
        cls: t.className, wrap: t.parentElement.className, wrapOv: getComputedStyle(t.parentElement).overflowX,
        w: Math.round(t.getBoundingClientRect().width)
      })))
    """))

    # ---- 3. clients: statc + filters + table wrap ----
    c.send('Page.navigate', {'url': BASE + 'preview-clients.html'})
    time.sleep(1.4)
    print('=== CLIENTS: statc/filters/table ===')
    print(c.eval("""
      (() => {
        const s = document.querySelector('.statc__value');
        const st = document.querySelector('.statc__text');
        const sel = document.querySelector('.cl-filters select, select');
        const tbl = document.querySelector('.cl-table');
        return JSON.stringify({
          value: s ? {cw: s.clientWidth, sw: s.scrollWidth, fs: getComputedStyle(s).fontSize, ws: getComputedStyle(s).whiteSpace} : null,
          text: st ? {cw: st.clientWidth, sw: st.scrollWidth} : null,
          sel: sel ? {h: Math.round(sel.getBoundingClientRect().height), fs: getComputedStyle(sel).fontSize} : null,
          table: tbl ? {wrap: tbl.parentElement.className, ov: getComputedStyle(tbl.parentElement).overflowX, w: tbl.scrollWidth} : null,
        }, null, 1);
      })()
    """))
    print('=== FILTER ROW STRUCTURE ===')
    print(c.eval("""
      (() => {
        const row = document.querySelector('.cl-filters');
        if (!row) return 'no .cl-filters';
        const cs = getComputedStyle(row);
        return JSON.stringify({cls: row.className, display: cs.display, cols: cs.gridTemplateColumns,
          children: [...row.children].map(c => c.className + ':' + Math.round(c.getBoundingClientRect().width))});
      })()
    """))
    c.ws.close()


if __name__ == '__main__':
    main()
