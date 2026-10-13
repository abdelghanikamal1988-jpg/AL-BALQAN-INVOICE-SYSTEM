"""Delete + recreate netlify-forms Edge Function with clean raw source.

The first deployment used a base64 body and may have left corrupt state
(OPTIONS preflight returns 500 while GET/POST work). Recreate fresh with
verify_jwt=false (the function validates the caller itself) and probe.
Also removes the diagnostic cors-test function.
Secrets come from env: SB_TOKEN (Supabase management access token).
"""
import io
import json
import os
import time
import urllib.error
import urllib.request

REF = "emwnetcjshdyvpkiiesp"
API = "https://api.supabase.com/v1/projects/" + REF
SB = os.environ["SB_TOKEN"]
ORIGIN = "https://abdelghanikamal1988-jpg.github.io"
SOURCE_PATH = "supabase/functions/netlify-forms/index.ts"


def call(method, url, payload=None):
    headers = {"Authorization": "Bearer " + SB, "Content-Type": "application/json"}
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", "replace")
    except Exception as exc:  # noqa: BLE001
        return 0, str(exc)


def brief(text, limit=200):
    return " ".join((text or "").split())[:limit]


def options_probe(tag):
    url = "https://%s.supabase.co/functions/v1/netlify-forms" % REF
    req = urllib.request.Request(
        url,
        method="OPTIONS",
        headers={
            "Origin": ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type,x-client-info",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            cors = {k: v for k, v in resp.headers.items() if "access-control-allow" in k.lower()}
            print(tag, "->", resp.status, cors)
            return resp.status
    except urllib.error.HTTPError as exc:
        cors = {k: v for k, v in exc.headers.items() if "access-control-allow" in k.lower()}
        print(tag, "->", exc.code, cors, "|", brief(exc.read().decode()))
        return exc.code
    except Exception as exc:  # noqa: BLE001
        print(tag, "-> ERR", repr(exc)[:80])
        return 0


def get_probe(tag):
    url = "https://%s.supabase.co/functions/v1/netlify-forms" % REF
    req = urllib.request.Request(url, headers={"Origin": ORIGIN})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            print(tag, "->", resp.status, resp.read().decode()[:80])
    except urllib.error.HTTPError as exc:
        print(tag, "->", exc.code, exc.read().decode()[:80])
    except Exception as exc:  # noqa: BLE001
        print(tag, "-> ERR", repr(exc)[:80])


source = io.open(SOURCE_PATH, encoding="utf-8").read()

print("1) delete old ->", call("DELETE", API + "/functions/netlify-forms")[0])
time.sleep(3)
st, body = call(
    "POST",
    API + "/functions",
    {
        "name": "netlify-forms",
        "slug": "netlify-forms",
        "body": source,
        "verify_jwt": False,
    },
)
print("2) create clean ->", st, brief(body))
time.sleep(8)

options_probe("3) OPTIONS")
get_probe("4) GET")

print("5) delete cors-test ->", call("DELETE", API + "/functions/cors-test")[0])
