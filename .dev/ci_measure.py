import sys, json, time, urllib.request
import websocket

PORT = 9333

def new_target(url):
    req = urllib.request.Request(f"http://localhost:{PORT}/json/new?{urllib.request.quote(url, safe='')}", method="PUT")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.load(r)

url = sys.argv[1]
width = int(sys.argv[2])
height = int(sys.argv[3])
out = sys.argv[4] if len(sys.argv) > 4 else None

JS = r"""
(() => {
  const info = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      display: cs.display, dir: cs.flexDirection, wrap: cs.flexWrap,
      gap: cs.gap, cols: cs.gridTemplateColumns, align: cs.alignItems,
      pad: cs.padding, minW: cs.minWidth,
    };
  };
  const btns = [...document.querySelectorAll('.editor-actions .btn')].map(b => {
    const r = b.getBoundingClientRect();
    return { t: b.textContent.trim().slice(0, 24), rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] };
  });
  const bad = [];
  const vw = document.documentElement.clientWidth;
  document.querySelectorAll('body *').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 && r.width > 0) {
      let p = el.parentElement, inScroll = false;
      while (p) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') { inScroll = true; break; } p = p.parentElement; }
      if (!inScroll) bad.push((el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(Boolean).slice(0,2).join('.') : el.tagName) + ':' + Math.round(r.width));
    }
  });
  return {
    vp: innerWidth, sw: document.documentElement.scrollWidth,
    pageHeader: info('.page-header'),
    actions: info('.editor-actions'),
    btns,
    layout: info('.editor-layout'),
    form: info('.editor-form'),
    preview: info('.preview-sticky'),
    formGrid: info('.form-grid'),
    sheetWrap: info('.invoice-sheet-wrap'),
    bad: bad.slice(0, 12),
  };
})()
"""

t = new_target(url)
ws = websocket.create_connection(t["webSocketDebuggerUrl"], timeout=30)
mid = [0]

def cmd(method, params=None):
    mid[0] += 1
    i = mid[0]
    ws.send(json.dumps({"id": i, "method": method, "params": params or {}}))
    while True:
        m = json.loads(ws.recv())
        if m.get("id") == i:
            return m.get("result", {})

def ev(expr):
    r = cmd("Runtime.evaluate", {"expression": expr, "returnByValue": True})
    if "exceptionDetails" in r:
        return {"ERROR": r["exceptionDetails"].get("exception", {}).get("description", "err")[:300]}
    return r.get("result", {}).get("value")

cmd("Page.enable")
cmd("Runtime.enable")
cmd("Emulation.setDeviceMetricsOverride", {
    "width": width, "height": height, "deviceScaleFactor": 2,
    "mobile": True, "screenWidth": width, "screenHeight": height})
cmd("Page.navigate", {"url": url})
time.sleep(3.5)
res = ev(JS)
ws.close()
txt = json.dumps(res, ensure_ascii=False, indent=1)
print("RESULT:", txt)
if out:
    open(out, "w", encoding="utf-8").write(txt)
