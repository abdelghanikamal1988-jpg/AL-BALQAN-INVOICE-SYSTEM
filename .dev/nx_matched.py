import json, time, urllib.request, websocket

PORT = 9333
url = "file:///C:/Users/hp/OneDrive/Desktop/desktop%20298/AL%20BALQAN%20Invoice%20system/.dev/nexus-dashboard.html"
req = urllib.request.Request(f"http://localhost:{PORT}/json/new?{urllib.request.quote(url, safe='')}", method="PUT")
t = json.load(urllib.request.urlopen(req, timeout=10))
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
cmd("DOM.enable")
cmd("CSS.enable")
time.sleep(6)
doc = cmd("DOM.getDocument", {"depth": -1})
nid = cmd("DOM.querySelector", {"nodeId": doc["root"]["nodeId"], "selector": ".card"})["nodeId"]
styles = cmd("CSS.getMatchedStylesForNode", {"nodeId": nid})
for entry in styles.get("matchedCSSRules", []):
    rule = entry["rule"]
    for d in rule.get("style", {}).get("cssText", []) or []:
        pass
    props = rule["style"].get("properties", [])
    for p in props:
        if "border-radius" in p.get("name", "") or p.get("name") == "border":
            print(rule["selectorList"]["text"][:120], "=>", p["name"], ":", p.get("value"), "imp:", p.get("important"), "| range:", entry.get("matchingSelectors"))
ws.close()
