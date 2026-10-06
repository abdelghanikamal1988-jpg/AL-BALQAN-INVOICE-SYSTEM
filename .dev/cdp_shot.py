import sys, json, time, base64, urllib.request
import websocket

PORT = 9333

def new_target(url):
    req = urllib.request.Request(f"http://localhost:{PORT}/json/new?{urllib.request.quote(url, safe='')}", method="PUT")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.load(r)

def main():
    url = sys.argv[1]
    width = int(sys.argv[2])
    height = int(sys.argv[3])
    out = sys.argv[4]
    eval_js = sys.argv[5] if len(sys.argv) > 5 else None
    if eval_js and eval_js.startswith("@"):
        with open(eval_js[1:], "r", encoding="utf-8") as f:
            eval_js = f.read()
    mobile = len(sys.argv) > 6 and sys.argv[6] == "mobile"

    t = new_target(url)
    ws = websocket.create_connection(t["webSocketDebuggerUrl"], timeout=20)
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
        "width": width, "height": height, "deviceScaleFactor": 2,
        "mobile": mobile, "screenWidth": width, "screenHeight": height,
    })
    cmd("Page.navigate", {"url": url})
    time.sleep(float(__import__("os").environ.get("CDP_WAIT", "6")))
    res = {}
    if eval_js:
        r = cmd("Runtime.evaluate", {"expression": eval_js, "returnByValue": True, "awaitPromise": False})
        if "exceptionDetails" in r:
            res = {"ERROR": r["exceptionDetails"].get("text"), "detail": r["exceptionDetails"]}
        else:
            res = r.get("result", {}).get("value")
            if res is None:
                res = {"RAW": r}
    shot = cmd("Page.captureScreenshot", {"format": "png", "fromSurface": True})
    with open(out, "wb") as f:
        f.write(base64.b64decode(shot["data"]))
    ws.close()
    print("RESULT:", json.dumps(res, ensure_ascii=False))

main()
