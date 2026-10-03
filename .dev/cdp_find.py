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
tests = json.loads(open(sys.argv[4], encoding="utf-8").read())  # list of [label, jsToHide, jsToRestore]

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

def emulate(h):
    cmd("Emulation.setDeviceMetricsOverride", {
        "width": width, "height": h, "deviceScaleFactor": 2,
        "mobile": True, "screenWidth": width, "screenHeight": height})

def ev(expr):
    r = cmd("Runtime.evaluate", {"expression": expr, "returnByValue": True})
    if "exceptionDetails" in r:
        return {"ERROR": r["exceptionDetails"].get("exception", {}).get("description", "err")[:120]}
    return r.get("result", {}).get("value")

cmd("Page.enable")
cmd("Runtime.enable")
emulate(height)
cmd("Page.navigate", {"url": url})
time.sleep(3.5)
base = ev("innerWidth")
print("base vp =", base)

h = height
for label, hide, restore in tests:
    ev(hide)
    h += 3
    emulate(h)
    time.sleep(0.5)
    vp = ev("innerWidth")
    print(f"hidden {label!r} -> vp = {vp}")
    ev(restore)
    h += 3
    emulate(h)
    time.sleep(0.4)

ws.close()
