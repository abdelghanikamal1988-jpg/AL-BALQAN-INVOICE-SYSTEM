"""Apply a SQL file to the production Supabase project via the Management
API (one statement per call, same approach as setup_remote.py).

Usage:
  $env:SB_TOKEN='sbp_...'; python .dev\apply_sql.py supabase\consultations.sql
"""
import io
import json
import os
import re
import sys
import urllib.error
import urllib.request

REF = 'emwnetcjshdyvpkiiesp'
API = 'https://api.supabase.com/v1/projects/' + REF
SB = os.environ['SB_TOKEN']


def call(method, url, payload=None):
    headers = {'Authorization': 'Bearer ' + SB, 'Content-Type': 'application/json'}
    data = json.dumps(payload).encode('utf-8') if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return r.status, r.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'replace')
    except Exception as e:
        return 0, str(e)


def brief(text, n=260):
    return re.sub(r'\s+', ' ', text or '').strip()[:n]


path = sys.argv[1] if len(sys.argv) > 1 else 'supabase/consultations.sql'
sql = io.open(path, encoding='utf-8').read()
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
    print('stmt %d -> HTTP %s %s' % (i, code, brief(body) if code >= 400 else ''))
    if code >= 400:
        ok = False
print('DONE' if ok else 'FAILED')
sys.exit(0 if ok else 1)
