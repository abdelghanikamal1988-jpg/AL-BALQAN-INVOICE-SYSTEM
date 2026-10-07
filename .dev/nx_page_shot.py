import sys, json, time, base64, urllib.request
import websocket

PORT = 9333


def new_target(url):
    req = urllib.request.Request(f"http://localhost:{PORT}/json/new?{urllib.request.quote(url, safe='')}", method="PUT")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.load(r)


url = sys.argv[1]
out = sys.argv[2]
width = int(sys.argv[3]) if len(sys.argv) > 3 else 1440
height = int(sys.argv[4]) if len(sys.argv) > 4 else 900

t = new_target("about:blank")
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


cmd("Page.enable")
cmd("Network.clearBrowserCookies")
cmd("Emulation.setDeviceMetricsOverride", {"width": width, "height": height, "deviceScaleFactor": 1, "mobile": width < 500})
cmd("Page.navigate", {"url": url})
time.sleep(6)
r = cmd("Runtime.evaluate", {"expression": "JSON.stringify({href:location.href, hasForm:!!document.querySelector('form')})", "returnByValue": True})
print("STATE:", r.get("result", {}).get("value"))
shot = cmd("Page.captureScreenshot", {"format": "png", "fromSurface": True})
with open(out, "wb") as f:
    f.write(base64.b64decode(shot["data"]))
ws.close()
print("saved", out)
