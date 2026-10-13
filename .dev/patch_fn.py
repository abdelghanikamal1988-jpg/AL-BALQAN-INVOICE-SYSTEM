"""Patch the deployed netlify-forms function with the local source and probe.

OPTIONS must return 204 + CORS headers (no body), GET must return 401.
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


source = io.open(SOURCE_PATH, encoding="utf-8").read()
st, body = call(
    "PATCH", API + "/functions/netlify-forms", {"body": source, "verify_jwt": False}
)
print("patch ->", st, brief(body))
time.sleep(6)

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
        cors = {k: v for k, v in resp.headers.items() if "access-control" in k.lower()}
        print("OPTIONS ->", resp.status, cors)
except urllib.error.HTTPError as exc:
    cors = {k: v for k, v in exc.headers.items() if "access-control" in k.lower()}
    print("OPTIONS ->", exc.code, cors, "|", brief(exc.read().decode()))

req = urllib.request.Request(url, headers={"Origin": ORIGIN})
try:
    with urllib.request.urlopen(req, timeout=20) as resp:
        print("GET ->", resp.status, resp.read().decode()[:80])
except urllib.error.HTTPError as exc:
    print("GET ->", exc.code, exc.read().decode()[:80])
