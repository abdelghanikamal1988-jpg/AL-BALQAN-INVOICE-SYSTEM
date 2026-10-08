"""Full-page CDP screenshot: loads a URL at width W, runs optional eval,
resizes viewport to the full scroll height, captures everything.

Usage: python cdp_full.py <url> <width> <out.png> [evaljs] [dpr]
"""

import base64
import json
import os
import sys
import time
import urllib.request

import websocket

PORT = 9333
MAX_H = 14000


def main():
    url = sys.argv[1]
    width = int(sys.argv[2])
    out = sys.argv[3]
    eval_js = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] else None
    if eval_js and eval_js.startswith("@"):
        with open(eval_js[1:], "r", encoding="utf-8") as f:
            eval_js = f.read()
    dpr = float(sys.argv[5]) if len(sys.argv) > 5 else 1.0

    req = urllib.request.Request(
        f"http://localhost:{PORT}/json/new?{urllib.request.quote(url, safe='')}",
        method="PUT",
    )
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
        "width": width, "height": 900, "deviceScaleFactor": dpr,
        "mobile": width < 500, "screenWidth": width, "screenHeight": 900,
    })
    cmd("Page.navigate", {"url": url})
    time.sleep(float(os.environ.get("CDP_WAIT", "2.5")))

    res = None
    if eval_js:
        r = cmd("Runtime.evaluate", {
            "expression": eval_js, "returnByValue": True, "awaitPromise": True,
        })
        if "exceptionDetails" in r:
            res = {"ERROR": r["exceptionDetails"].get("text")}
        else:
            res = r.get("result", {}).get("value")

    h = cmd("Runtime.evaluate", {
        "expression": "Math.min(document.documentElement.scrollHeight, %d)" % MAX_H,
        "returnByValue": True,
    })["result"]["value"]

    cmd("Emulation.setDeviceMetricsOverride", {
        "width": width, "height": int(h), "deviceScaleFactor": dpr,
        "mobile": width < 500, "screenWidth": width, "screenHeight": int(h),
    })
    time.sleep(0.4)
    shot = cmd("Page.captureScreenshot", {"format": "png", "fromSurface": True})
    with open(out, "wb") as f:
        f.write(base64.b64decode(shot["data"]))
    ws.close()
    print("RESULT:", json.dumps({"h": h, "eval": res}, ensure_ascii=False))


main()
