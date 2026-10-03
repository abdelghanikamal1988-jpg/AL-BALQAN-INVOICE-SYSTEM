import sys, json, time, base64, urllib.request
import websocket

PORT = 9333

def new_target(url):
    req = urllib.request.Request(f"http://localhost:{PORT}/json/new?{urllib.request.quote(url, safe='')}", method="PUT")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.load(r)

url, width, height, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]

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
        return {"ERROR": r["exceptionDetails"].get("exception", {}).get("description", "err")[:200]}
    return r.get("result", {}).get("value")

cmd("Page.enable")
cmd("Runtime.enable")
cmd("Emulation.setDeviceMetricsOverride", {
    "width": width, "height": height, "deviceScaleFactor": 2,
    "mobile": True, "screenWidth": width, "screenHeight": height})
cmd("Emulation.setTouchEmulationEnabled", {"enabled": True, "maxTouchPoints": 5})
cmd("Page.navigate", {"url": url})
time.sleep(4)

probe = ev("""(function(){
var res={vp:innerWidth,sw:document.documentElement.scrollWidth};
var f=function(sel){var e=document.querySelector(sel);if(!e)return null;var r=e.getBoundingClientRect();return [Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)];};
res.email=f('input[type=email], input[name=email], input[type=text]'); res.email = res.email||f('.login-card input');
res.pass=f('input[type=password]');
res.submit=f('button[type=submit]');
res.toast=(function(){var t=document.querySelector('.toast-container');if(!t)return null;var r=t.getBoundingClientRect();var cs=getComputedStyle(t);return {rect:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],pe:cs.pointerEvents};})();
return res;})()""")

# real tap on email input
if probe and probe.get("email"):
    x = probe["email"][0] + probe["email"][2] / 2
    y = probe["email"][1] + probe["email"][3] / 2
    cmd("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y, "id": 1}]})
    cmd("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    time.sleep(0.6)
    focused = ev("(function(){var a=document.activeElement;return {tag:a.tagName,type:a.type||'',cls:(a.getAttribute('class')||'').slice(0,25),isEmail:a===document.querySelector('.login-card input')};})()")
    probe["afterTap"] = focused

# tap submit
if probe and probe.get("submit"):
    x = probe["submit"][0] + probe["submit"][2] / 2
    y = probe["submit"][1] + probe["submit"][3] / 2
    hit = ev(f"(function(){{var h=document.elementFromPoint({x},{y});return h?((h.tagName+'.'+(h.getAttribute('class')||'')).slice(0,60)):'NONE';}})()")
    probe["submitHit"] = hit

shot = cmd("Page.captureScreenshot", {"format": "png", "fromSurface": True})
with open(out, "wb") as f:
    f.write(base64.b64decode(shot["data"]))
ws.close()
print("RESULT:", json.dumps(probe, ensure_ascii=False))
