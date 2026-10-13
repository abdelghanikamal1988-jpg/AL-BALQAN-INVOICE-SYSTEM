"""Diagnose OPTIONS/preflight 500 on Supabase Edge Functions.

Creates a tiny control function, probes OPTIONS on both, prints metadata.
Secrets come from env: SB_TOKEN (Supabase management access token).
"""
import json
import os
import time
import urllib.error
import urllib.request

REF = "emwnetcjshdyvpkiiesp"
API = "https://api.supabase.com/v1/projects/" + REF
SB = os.environ["SB_TOKEN"]
ORIGIN = "https://abdelghanikamal1988-jpg.github.io"


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


def options_probe(slug, tag):
    url = "https://%s.supabase.co/functions/v1/%s" % (REF, slug)
    req = urllib.request.Request(
        url,
        method="OPTIONS",
        headers={
            "Origin": ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            cors = {k: v for k, v in resp.headers.items() if "access-control-allow" in k.lower()}
            print(tag, "->", resp.status, cors)
    except urllib.error.HTTPError as exc:
        cors = {k: v for k, v in exc.headers.items() if "access-control-allow" in k.lower()}
        print(tag, "->", exc.code, cors, "|", exc.read().decode()[:60])
    except Exception as exc:  # noqa: BLE001
        print(tag, "-> ERR", repr(exc)[:80])


def get_probe(slug, tag):
    url = "https://%s.supabase.co/functions/v1/%s" % (REF, slug)
    req = urllib.request.Request(url, headers={"Origin": ORIGIN})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            print(tag, "->", resp.status, resp.read().decode()[:80])
    except urllib.error.HTTPError as exc:
        print(tag, "->", exc.code, exc.read().decode()[:80])


st, body = call(
    "POST",
    API + "/functions",
    {
        "name": "cors-test",
        "slug": "cors-test",
        "body": "Deno.serve(() => new Response('ok'));",
        "verify_jwt": False,
    },
)
print("create cors-test ->", st, body[:200])
time.sleep(8)

options_probe("cors-test", "OPTIONS cors-test")
options_probe("netlify-forms", "OPTIONS netlify-forms")
get_probe("cors-test", "GET cors-test")
get_probe("netlify-forms", "GET netlify-forms")

st, body = call("GET", API + "/functions/netlify-forms")
print("meta netlify-forms ->", st, body[:600])
st, body = call("GET", API + "/functions/cors-test")
print("meta cors-test ->", st, body[:400])
