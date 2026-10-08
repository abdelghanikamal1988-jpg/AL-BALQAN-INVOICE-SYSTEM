import json
import sys
import time
import urllib.request

import websocket

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE = ('file:///C:/Users/hp/OneDrive/Desktop/desktop%20298/'
        'AL%20BALQAN%20Invoice%20system/.dev/')

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
send('Emulation.setDeviceMetricsOverride',
     {'width': 1024, 'height': 844, 'deviceScaleFactor': 1, 'mobile': False})
send('Page.navigate', {'url': BASE + 'preview-history.html'})
time.sleep(1.2)

JS = r"""
(() => {
  const t = document.querySelector('table');
  const td = t.querySelector('tbody td');
  const info = {
    tableCls: t.className,
    tableFs: getComputedStyle(t).fontSize,
    tdFs: getComputedStyle(td).fontSize,
    tdCls: td.className,
    tdText: td.textContent.trim().slice(0, 30),
    parentFs: getComputedStyle(td.parentElement).fontSize,
    parentCls: td.parentElement.className,
    // walk ancestors
    chain: [],
  };
  let p = td;
  while (p && p !== document.body) {
    info.chain.push((p.tagName + '.' + (p.className || '')).slice(0, 50) + ' fs=' + getComputedStyle(p).fontSize);
    p = p.parentElement;
  }
  // list CSS rules matching this td that set font-size
  info.rules = [];
  const check = (rules, href) => {
    for (const r of rules) {
      if (r.constructor.name === 'CSSMediaRule') { check(r.cssRules, href + '@media'); continue; }
      if (!r.selectorText) continue;
      try {
        if (td.matches(r.selectorText) && /font-size/.test(r.cssText)) {
          info.rules.push((href || '') + ' :: ' + r.cssText.slice(0, 160));
        }
      } catch (e) {}
    }
  };
  for (const sh of document.styleSheets) {
    try { check(sh.cssRules, (sh.href || 'inline').split('/').pop()); } catch (e) {}
  }
  return JSON.stringify(info, null, 1);
})()
"""
r = send('Runtime.evaluate', {'expression': JS, 'returnByValue': True})
print(r['result']['result'].get('value'))
ws.close()
