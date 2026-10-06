import sys, json, time, base64, urllib.request
import websocket

PORT = 9333

def new_target(url):
    req = urllib.request.Request(f"http://localhost:{PORT}/json/new?{urllib.request.quote(url, safe='')}", method="PUT")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.load(r)

url = sys.argv[1]
width = int(sys.argv[2])
height = int(sys.argv[3])
out = sys.argv[4]
limit = float(sys.argv[5]) if len(sys.argv) > 5 else 40

CHECK = "document.querySelector('.editor-layout') ? 'ready' : (document.body.innerText.indexOf('Loading invoice') >= 0 ? 'loading' : 'other')"

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
        return "ERR"
    return r.get("result", {}).get("value")

cmd("Page.enable")
cmd("Runtime.enable")
cmd("Emulation.setDeviceMetricsOverride", {"width": width, "height": height, "deviceScaleFactor": 2, "mobile": True, "screenWidth": width, "screenHeight": height})
cmd("Page.navigate", {"url": url})
start = time.time()
state = "init"
while time.time() - start < limit:
    time.sleep(1.5)
    state = ev(CHECK)
    if state == "ready":
        break
elapsed = round(time.time() - start, 1)
time.sleep(1.5)
shot = cmd("Page.captureScreenshot", {"format": "png", "fromSurface": True})
with open(out, "wb") as f:
    f.write(base64.b64decode(shot["data"]))
ws.close()
print(f"RESULT: state={state} after {elapsed}s -> {out}")
