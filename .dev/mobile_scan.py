"""Mobile/RTL overflow scan: loads each preview harness at several widths
(+ dir=rtl) and reports horizontal overflow + the offending elements."""

import json
import sys
import time
import urllib.request

import websocket

PORT = 9333
BASE = "file:///C:/Users/hp/OneDrive/Desktop/desktop%20298/AL%20BALQAN%20Invoice%20system/.dev/"

PAGES = [
    "preview-dashboard.html", "preview-shell.html", "preview-clients.html",
    "preview-detail.html", "preview-form.html", "preview-create.html",
    "preview-history.html", "preview-admin.html", "preview-inbox.html",
    "preview-pending.html", "preview-gate.html", "preview-header.html",
]
WIDTHS = [360, 390, 768]

EVAL_JS = """
(async () => {
  const vw = window.innerWidth;
  const bad = [];
  document.querySelectorAll('body *').forEach(el => {
    const b = el.getBoundingClientRect();
    if (b.width > vw + 2 && b.width > 60) {
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed') return;
      let p = el.parentElement, clipped = false;
      while (p) {
        const ps = getComputedStyle(p);
        if (ps.overflowX === 'auto' || ps.overflowX === 'hidden' || ps.overflowX === 'clip') { clipped = true; break; }
        p = p.parentElement;
      }
      if (clipped) return;
      const cls = (typeof el.className === 'string' && el.className) ? '.' + el.className.trim().split(/\\s+/).join('.').slice(0, 60) : el.tagName;
      bad.push(cls + ' w=' + Math.round(b.width) + ' r=' + Math.round(b.right));
    }
  });
  return JSON.stringify({
    page: location.pathname.split('/').pop(),
    vw,
    bodyW: document.body.scrollWidth,
    docW: document.documentElement.scrollWidth,
    bad: bad.slice(0, 6),
  });
})()
"""


def targets():
    req = urllib.request.Request(f"http://127.0.0.1:{PORT}/json")
    with urllib.request.urlopen(req, timeout=5) as r:
        return json.load(r)


def run():
    problems = []
    for page in PAGES:
        for w in WIDTHS:
            for rtl in (False, True):
                ts = targets()
                page_t = next((t for t in ts if t["type"] == "page"), ts[0])
                ws = websocket.create_connection(page_t["webSocketDebuggerUrl"], timeout=20)
                if ws.sock:
                    ws.sock.settimeout(3)
                nav = {
                    "id": 1, "method": "Page.navigate",
                    "params": {"url": BASE + page},
                }
                ws.send(json.dumps(nav))
                time.sleep(1.2)
                setd = {
                    "id": 2, "method": "Emulation.setDeviceMetricsOverride",
                    "params": {"width": w, "height": 900, "deviceScaleFactor": 1, "mobile": w < 500},
                }
                ws.send(json.dumps(setd))
                if rtl:
                    ws.send(json.dumps({
                        "id": 3, "method": "Runtime.evaluate",
                        "params": {"expression": "document.documentElement.dir='rtl';document.documentElement.lang='ar'"},
                    }))
                ws.send(json.dumps({"id": 4, "method": "Runtime.evaluate", "params": {"expression": EVAL_JS, "awaitPromise": True}}))
                result = None
                end = time.time() + 12
                while time.time() < end:
                    try:
                        raw = ws.recv()
                    except websocket.WebSocketTimeoutException:
                        continue
                    except Exception as e:
                        print(f"RECVERR {page}: {type(e).__name__}: {e}", flush=True)
                        break
                    try:
                        msg = json.loads(raw)
                    except Exception:
                        continue
                    if msg.get("id") == 4:
                        result = msg
                        break
                ws.close()
                if not result:
                    print(f"TIMEOUT {page} {w} rtl={rtl}", flush=True)
                    continue
                try:
                    val = result["result"]["result"]["value"]
                    data = json.loads(val)
                except Exception as e:
                    print(f"EVALERR {page} {w}: {e}", flush=True)
                    continue
                over = max(data["bodyW"], data["docW"]) - data["vw"]
                if over > 1 or data["bad"]:
                    tag = f"{data['page']} w={w} rtl={rtl} over={over}px bodyW={data['bodyW']} bad={data['bad']}"
                    problems.append(tag)
                    print(tag, flush=True)
                else:
                    print(f"OK {data['page']} w={w} rtl={rtl}", flush=True)
    print(f"\n=== {len(problems)} problem configs ===")


if __name__ == "__main__":
    run()
