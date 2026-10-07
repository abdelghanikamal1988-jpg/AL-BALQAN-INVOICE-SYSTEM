"""Live verification: open the deployed app, sign in (saved demo session),
probe the new navbar/sidebar geometry, toggle collapse, save screenshots."""

import sys, json, time, base64, urllib.request
import websocket

PORT = 9333
URL = "https://abdelghanikamal1988-jpg.github.io/AL-BALQAN-INVOICE-SYSTEM/"


def new_target(url):
    req = urllib.request.Request(
        f"http://localhost:{PORT}/json/new?{urllib.request.quote(url, safe='')}",
        method="PUT",
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.load(r)


t = new_target("about:blank")
ws = websocket.create_connection(t["webSocketDebuggerUrl"], timeout=40)
mid = [0]


def cmd(method, params=None):
    mid[0] += 1
    i = mid[0]
    ws.send(json.dumps({"id": i, "method": method, "params": params or {}}))
    while True:
        m = json.loads(ws.recv())
        if m.get("id") == i:
            return m.get("result", {})


def js(expr, wait=0):
    if wait:
        time.sleep(wait)
    r = cmd("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True})
    if "exceptionDetails" in r:
        return {"ERROR": r["exceptionDetails"].get("text")}
    return r.get("result", {}).get("value")


def shot(path):
    s = cmd("Page.captureScreenshot", {"format": "png", "fromSurface": True})
    with open(path, "wb") as f:
        f.write(base64.b64decode(s["data"]))
    print("saved", path)


cmd("Page.enable")
cmd("Runtime.enable")
cmd("Emulation.setDeviceMetricsOverride", {
    "width": 1440, "height": 900, "deviceScaleFactor": 1, "mobile": False,
})
cmd("Page.navigate", {"url": URL})
time.sleep(7)

state = js("""JSON.stringify({
  href: location.href,
  login: !!document.querySelector('input[type=password]'),
  shell: !!document.querySelector('.app-shell'),
  email: (document.querySelector('input[type=email]')||{}).value || '',
  css: getComputedStyle(document.body).backgroundColor
})""")
print("STATE:", state)

if state and isinstance(state, str) and '"login":true' in state.replace(" ", ""):
    shot(".dev/lx1-login.png")
    clicked = js("(() => { const b = document.querySelector('.login-form button[type=submit]'); if (!b) return 'no-btn'; b.click(); return 'clicked'; })()", 1)
    print("CLICK:", clicked)
    time.sleep(6)
    state = js("""JSON.stringify({
      login: !!document.querySelector('input[type=password]'),
      shell: !!document.querySelector('.app-shell'),
      toast: (document.querySelector('.toast')||{}).innerText || ''
    })""")
    print("AFTER LOGIN:", state)

geo = js("""(() => {
  const g = (sel) => { const el = document.querySelector(sel); if (!el) return null;
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return {x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), disp: cs.display}; };
  return JSON.stringify({
    vw: innerWidth,
    menu: g('.app-header__menu'),
    brand: g('.app-header__brand'),
    search: g('.topsearch__input'),
    cta: g('.app-header__cta'),
    tool: g('.app-header__tool'),
    bell: g('.app-header__bell'),
    chip: g('.app-header__user'),
    sidebar: g('.sidebar'),
    open: !!document.querySelector('.sidebar.is-open')
  });
})()""")
print("GEO OPEN:", geo)
shot(".dev/lx1-shell.png")

toggle = js("""(() => {
  const b = document.querySelector('.app-header__menu'); if (!b) return 'no-menu';
  b.click();
  return new Promise(r => setTimeout(() => {
    const s = document.querySelector('.sidebar');
    const sr = s ? s.getBoundingClientRect() : null;
    r(JSON.stringify({sidebarW: sr ? Math.round(sr.width) : null,
      aria: b.getAttribute('aria-expanded'),
      open: s ? s.classList.contains('is-open') : null}));
  }, 500));
})()""")
print("TOGGLE:", toggle)
shot(".dev/lx1-shell-collapsed.png")

# Search dropdown: focus, type, wait for results
search = js("""(() => {
  const i = document.querySelector('.topsearch__input'); if (!i) return 'no-input';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(i, 'a');
  i.dispatchEvent(new Event('input', {bubbles: true}));
  i.focus();
  return 'typing';
})()""", 0)
print("SEARCH:", search)
time.sleep(2.5)
panel = js("""(() => {
  const p = document.querySelector('.topsearch__panel');
  const items = document.querySelectorAll('.topsearch__item');
  return JSON.stringify({panel: !!p, items: items.length,
    first: items[0] ? items[0].innerText.replace(/\\n/g,' | ') : ''});
})()""")
print("PANEL:", panel)
shot(".dev/lx1-search.png")

ws.close()
