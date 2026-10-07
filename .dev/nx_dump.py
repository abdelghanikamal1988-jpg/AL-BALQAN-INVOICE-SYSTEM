import sys, json, time, base64, urllib.request
import websocket

PORT = 9333


def new_target(url):
    req = urllib.request.Request(f"http://localhost:{PORT}/json/new?{urllib.request.quote(url, safe='')}", method="PUT")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.load(r)


t = new_target("https://nexus.getstocky.com/login")
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


def js(expr):
    r = cmd("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True})
    if "exceptionDetails" in r:
        return {"ERR": r["exceptionDetails"].get("text")}
    return r.get("result", {}).get("value")


cmd("Page.enable")
cmd("Runtime.enable")
cmd("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 900, "deviceScaleFactor": 1, "mobile": False})
cmd("Page.navigate", {"url": "https://nexus.getstocky.com/login"})
time.sleep(4)

login_js = """
(function(){
  var form = document.querySelector('form[action*="/login"]');
  if(!form) return 'noform';
  var em = form.querySelector('input[type=email]');
  var pw = form.querySelector('input[type=password]');
  var set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
  set.call(em, 'admin@nexus.test'); em.dispatchEvent(new Event('input',{bubbles:true}));
  set.call(pw, 'password'); pw.dispatchEvent(new Event('input',{bubbles:true}));
  form.submit();
  return 'submitted';
})()
"""
print("LOGIN:", js(login_js))
time.sleep(6)
print("HREF:", js("location.href"))

html = js("document.documentElement.outerHTML")
with open(".dev/nexus-dashboard.html", "w", encoding="utf-8") as f:
    f.write(html if isinstance(html, str) else str(html))
print("saved .dev/nexus-dashboard.html len=", len(html) if isinstance(html, str) else 0)

print("BODYCLASS:", js("document.body.className"))
print("TOGGLE:", js("""JSON.stringify([...document.querySelectorAll('button,a')].filter(b=>/sidenav|sidebar|toggler|menu/i.test((b.className||'')+' '+(b.getAttribute('aria-label')||'')+' '+(b.getAttribute('title')||'')+' '+(b.dataset&&JSON.stringify(b.dataset)||''))).map(b=>({tag:b.tagName,cls:b.className,aria:b.getAttribute('aria-label'),title:b.getAttribute('title'),ds:b.dataset})))"""))

shot = cmd("Page.captureScreenshot", {"format": "png", "fromSurface": True})
with open(r"C:\Users\hp\AppData\Local\Temp\opencode\nx-shots\nx-dash-fresh.png", "wb") as f:
    f.write(base64.b64decode(shot["data"]))
ws.close()
print("done")
