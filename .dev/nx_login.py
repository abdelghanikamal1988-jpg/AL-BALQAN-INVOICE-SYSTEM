import sys, json, time, base64, urllib.request
import websocket

PORT = 9333

def new_target(url):
    req = urllib.request.Request(f"http://localhost:{PORT}/json/new?{urllib.request.quote(url, safe='')}", method="PUT")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.load(r)

def main():
    email = sys.argv[1] if len(sys.argv) > 1 else "admin@nexus.test"
    out = sys.argv[2] if len(sys.argv) > 2 else "nx_out.png"

    t = new_target("https://nexus.getstocky.com/login")
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

    def js(expr):
        r = cmd("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True})
        if "exceptionDetails" in r:
            return {"ERR": r["exceptionDetails"].get("text")}
        return r.get("result", {}).get("value")

    cmd("Page.enable")
    cmd("Runtime.enable")
    cmd("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 1500, "deviceScaleFactor": 2, "mobile": False})
    cmd("Page.navigate", {"url": "https://nexus.getstocky.com/login"})
    time.sleep(4)

    print("PRE:", js("JSON.stringify({href:location.href, tiles:document.querySelectorAll('.demo-accounts a, [data-email], .tile').length, forms:document.forms.length})"))

    login_js = """
    (function(){
      var form = document.querySelector('form[action*="/login"]');
      if(!form) return JSON.stringify({stage:'noform', forms:document.forms.length});
      var em = form.querySelector('input[type=email], input[name=email]');
      var pw = form.querySelector('input[type=password], input[name=password]');
      if(!em||!pw) return JSON.stringify({stage:'nofield', html:form.outerHTML.slice(0,300)});
      var set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      set.call(em, %s); em.dispatchEvent(new Event('input',{bubbles:true})); em.dispatchEvent(new Event('change',{bubbles:true}));
      set.call(pw, 'password'); pw.dispatchEvent(new Event('input',{bubbles:true})); pw.dispatchEvent(new Event('change',{bubbles:true}));
      form.submit();
      return JSON.stringify({stage:'submitted'});
    })()
    """ % json.dumps(email)
    print("POST:", js(login_js))
    time.sleep(6)
    print("AFTER:", js("JSON.stringify({href:location.href,title:document.title,body:document.body.innerText.slice(0,500)})"))

    shot = cmd("Page.captureScreenshot", {"format": "png", "fromSurface": True})
    with open(out, "wb") as f:
        f.write(base64.b64decode(shot["data"]))
    ws.close()

main()
