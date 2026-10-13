"""One-off remote setup: create the consultation_requests table, deploy the
netlify-forms Edge Function, and store the NETLIFY_TOKEN secret through the
Supabase Management API, then verify table/function/Netlify reachability.

Usage (tokens via env, never hard-coded):
  $env:SB_TOKEN='sbp_...'; $env:NETLIFY_PAT='nfp_...'; python .dev/setup_remote.py
"""

import base64
import io
import json
import os
import re
import urllib.error
import urllib.request

REF = 'emwnetcjshdyvpkiiesp'
API = 'https://api.supabase.com/v1/projects/' + REF
FN_URL = 'https://%s.functions.supabase.co/netlify-forms' % REF
PUBLISHABLE = 'sb_publishable_AyRzou891T45q9FkPbNsfQ_UlxVQ9mp'
SITE_ID = 'c62355e1-108a-4b41-bc0d-6e5a6acda6ed'
SB = os.environ['SB_TOKEN']
NPAT = os.environ['NETLIFY_PAT']


def call(method, url, payload=None, headers=None):
    h = {'Authorization': 'Bearer ' + SB, 'Content-Type': 'application/json'}
    if headers:
        h.update(headers)
    data = json.dumps(payload).encode('utf-8') if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return r.status, r.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'replace')
    except Exception as e:
        return 0, str(e)


def brief(text, n=260):
    text = re.sub(r'\s+', ' ', text or '').strip()
    return text[:n]


print('== 1. SQL migration ==')
sql = io.open('supabase/consultations.sql', encoding='utf-8').read()
statements = []
buf = []
for line in sql.splitlines():
    if line.strip().startswith('--'):
        continue
    buf.append(line)
    if line.rstrip().endswith(';'):
        statements.append('\n'.join(buf))
        buf = []
if ''.join(buf).strip():
    statements.append('\n'.join(buf))
ok = True
for i, st in enumerate(statements, 1):
    code, body = call('POST', API + '/database/query', payload={'query': st})
    print('  stmt %d -> HTTP %s %s' % (i, code, brief(body) if code >= 400 else ''))
    if code >= 400:
        ok = False
print('  SQL:', 'DONE' if ok else 'FAILED')

print('== 2. Edge Function deploy ==')
src = io.open('supabase/functions/netlify-forms/index.ts', encoding='utf-8').read()
b64 = base64.b64encode(src.encode('utf-8')).decode('ascii')
code, body = call('POST', API + '/functions',
                  payload={'slug': 'netlify-forms', 'name': 'netlify-forms',
                           'body': b64, 'verify_jwt': True})
print('  create -> HTTP %s %s' % (code, brief(body)))
if code in (400, 409, 422):
    code, body = call('PATCH', API + '/functions/netlify-forms',
                      payload={'body': b64, 'verify_jwt': True})
    print('  update -> HTTP %s %s' % (code, brief(body)))

print('== 3. NETLIFY_TOKEN secret ==')
code, body = call('POST', API + '/secrets', payload={'NETLIFY_TOKEN': NPAT})
print('  set -> HTTP %s %s' % (code, brief(body)))

print('== 4. verify table ==')
req = urllib.request.Request(
    'https://%s.supabase.co/rest/v1/consultation_requests?select=id&limit=1' % REF,
    headers={'apikey': PUBLISHABLE, 'Authorization': 'Bearer ' + PUBLISHABLE})
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        print('  rest -> HTTP %s body=%s' % (r.status, r.read().decode()[:120]))
except urllib.error.HTTPError as e:
    print('  rest -> HTTP %s %s' % (e.code, brief(e.read().decode())))

print('== 5. verify function deployed ==')
req = urllib.request.Request(
    FN_URL, data=json.dumps({'action': 'forms'}).encode(),
    headers={'apikey': PUBLISHABLE, 'Content-Type': 'application/json'},
    method='POST')
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        print('  fn -> HTTP %s %s' % (r.status, brief(r.read().decode())))
except urllib.error.HTTPError as e:
    print('  fn -> HTTP %s %s' % (e.code, brief(e.read().decode())))

print('== 6. verify Netlify token + form ==')
req = urllib.request.Request(
    'https://api.netlify.com/api/v1/sites/%s/forms' % SITE_ID,
    headers={'Authorization': 'Bearer ' + NPAT})
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        forms = json.loads(r.read().decode())
        names = [f.get('name') for f in forms]
        print('  netlify -> HTTP %s forms=%s' % (r.status, names))
except urllib.error.HTTPError as e:
    print('  netlify -> HTTP %s %s' % (e.code, brief(e.read().decode())))
