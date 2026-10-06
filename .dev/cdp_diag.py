import sys, json, time, base64, urllib.request
import websocket

PORT = 9333

def new_target(url):
    req = urllib.request.Request(f"http://localhost:{PORT}/json/new?{urllib.request.quote(url, safe='')}", method="PUT")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.load(r)

url = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else None

JS = r"""
(() => {
  const o = document.querySelector('vite-error-overlay');
  const overlay = o && o.shadowRoot ? o.shadowRoot.textContent.slice(0, 900) : 'no-overlay';
  const errs = (window.__errs || []).slice(0, 5);
  return { overlay, errs, body: document.body.innerText.slice(0, 300) };
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

cmd("Page.enable")
cmd("Runtime.enable")
cmd("Log.enable")
# collect console/log entries
cmd("Emulation.setDeviceMetricsOverride", {"width": 900, "height": 700, "deviceScaleFactor": 2, "mobile": True, "screenWidth": 900, "screenHeight": 700})
cmd("Page.navigate", {"url": url})
logs = []
end = time.time() + 6
while time.time() < end:
    ws.settimeout(1)
    try:
        m = json.loads(ws.recv())
    except Exception:
        continue
    if m.get("method") in ("Runtime.consoleAPICalled", "Log.entryAdded", "Runtime.exceptionThrown"):
        logs.append(json.dumps(m)[:600])
r = cmd("Runtime.evaluate", {"expression": JS, "returnByValue": True})
res = r.get("result", {}).get("value")
ws.close()
print("PAGE:", json.dumps(res, ensure_ascii=False, indent=1))
print("LOGS:", len(logs))
for l in logs[:8]:
    print("-", l)
if out:
    open(out, "w", encoding="utf-8").write(json.dumps({"page": res, "logs": logs}, ensure_ascii=False, indent=1))
