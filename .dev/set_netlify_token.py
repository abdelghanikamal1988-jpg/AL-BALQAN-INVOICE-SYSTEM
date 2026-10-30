"""Rotate NETLIFY_TOKEN, verify it against the Netlify API, then run a live sync.

Usage:
  $env:SB_TOKEN='sbp_...'; $env:NETLIFY_PAT='nfp_...'; python .dev\set_netlify_token.py
"""

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
NETLIFY_API = 'https://api.netlify.com/api/v1'
SB = os.environ['SB_TOKEN']
NPAT = os.environ['NETLIFY_PAT'].strip()


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


def brief(text, n=280):
    return re.sub(r'\s+', ' ', text or '').strip()[:n]


print('== 0. token shape ==')
print('  prefix:', NPAT[:5], 'length:', len(NPAT))

print('== 1. Netlify accepts the token? ==')
code, body = call('GET', NETLIFY_API + '/sites/' + SITE_ID + '/forms',
                  headers={'Authorization': 'Bearer ' + NPAT})
names = []
if code == 200:
    try:
        names = [f.get('name') for f in json.loads(body)]
    except Exception:
        pass
print('  forms -> HTTP %s names=%s %s' % (code, names, brief(body) if code >= 400 else ''))
if code != 200:
    print('  STOP: Netlify rejected the new token too.')
    raise SystemExit(1)

print('== 2. set Supabase secret ==')
code, body = call('POST', API + '/secrets', payload={'NETLIFY_TOKEN': NPAT})
print('  set -> HTTP %s %s' % (code, brief(body)))
if code in (400, 409, 422):
    code, body = call('PATCH', API + '/secrets', payload={'NETLIFY_TOKEN': NPAT})
    print('  update -> HTTP %s %s' % (code, brief(body)))

print('== 3. live function probe ==')
for action in ('forms', 'submissions'):
    code, body = call('POST', FN_URL, payload={'action': action},
                      headers={'Authorization': 'Bearer ' + PUBLISHABLE,
                               'apikey': PUBLISHABLE})
    print('  %s -> HTTP %s %s' % (action, code, brief(body)))

print('== 4. rows in consultation_requests ==')
code, body = call('GET', 'https://%s.supabase.co/rest/v1/consultation_requests'
                         '?select=id,full_name,email,submitted_at&order=submitted_at.desc&limit=5' % REF,
                  headers={'Authorization': 'Bearer ' + PUBLISHABLE, 'apikey': PUBLISHABLE})
print('  rest -> HTTP %s %s' % (code, brief(body)))
