import sys, json, time, base64, urllib.request
import websocket

PORT = 9333

def main():
    url = sys.argv[1]
    prefix = sys.argv[2]
    offsets = [int(x) for x in sys.argv[3].split(',')]

    req = urllib.request.Request(f"http://localhost:{PORT}/json/new?{urllib.request.quote(url, safe='')}", method="PUT")
    with urllib.request.urlopen(req, timeout=10) as r:
        t = json.load(r)
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
    cmd("Runtime.enable")
    cmd("Emulation.setDeviceMetricsOverride", {
        "width": 1440, "height": 900, "deviceScaleFactor": 2,
        "mobile": False, "screenWidth": 1440, "screenHeight": 900,
    })
    cmd("Page.navigate", {"url": url})
    time.sleep(9)
    for off in offsets:
        cmd("Runtime.evaluate", {"expression": f"document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,{off});'ok'"})
        time.sleep(1.6)
        shot = cmd("Page.captureScreenshot", {"format": "png", "fromSurface": True})
        path = f"{prefix}-{off}.png"
        with open(path, "wb") as f:
            f.write(base64.b64decode(shot["data"]))
        print("saved", path)
    ws.close()

main()
