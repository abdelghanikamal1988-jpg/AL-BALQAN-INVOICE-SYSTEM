"""Temporary mobile-QA test user for the production Supabase project.

Usage:
  $env:SB_TOKEN='sbp_...'; python .dev\testuser.py create
  $env:SB_TOKEN='sbp_...'; python .dev\testuser.py id
  $env:SB_TOKEN='sbp_...'; python .dev\testuser.py profile
  $env:SB_TOKEN='sbp_...'; python .dev\testuser.py delete
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request

REF = 'emwnetcjshdyvpkiiesp'
API = 'https://api.supabase.com/v1/projects/' + REF
SB = os.environ['SB_TOKEN']
EMAIL = 'test-mobile@albalqan.com'
PASSWORD = 'Tmp-Mobile-2026!'


def call(method, url, payload=None):
    headers = {'Authorization': 'Bearer ' + SB, 'Content-Type': 'application/json'}
    data = json.dumps(payload).encode('utf-8') if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return r.status, r.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'replace')
    except Exception as e:  # noqa: BLE001
        return 0, str(e)


def brief(text, n=300):
    return re.sub(r'\s+', ' ', text or '').strip()[:n]


def get_id():
    code, body = call('GET', API + '/auth/users?page=1&per_page=200')
    if code >= 400:
        print('list failed', code, brief(body))
        return None
    for u in json.loads(body).get('users', []):
        if u.get('email') == EMAIL:
            return u['id']
    return None


cmd = sys.argv[1] if len(sys.argv) > 1 else 'id'

if cmd == 'create':
    uid = get_id()
    if uid:
        print('exists', uid)
        sys.exit(0)
    code, body = call('POST', API + '/auth/users', payload={
        'email': EMAIL, 'password': PASSWORD, 'email_confirm': True,
        'user_metadata': {'name': 'Mobile QA'},
    })
    print('create -> HTTP', code, brief(body) if code >= 400 else '')
    uid = get_id()
    print('uid', uid)
    print('email', EMAIL)
    print('password', PASSWORD)
    sys.exit(0 if uid else 1)

if cmd == 'id':
    uid = get_id()
    print(uid or 'NOT FOUND')
    sys.exit(0 if uid else 1)

if cmd == 'profile':
    uid = get_id()
    if not uid:
        print('no user')
        sys.exit(1)
    sql = (
        "insert into public.profiles (id, role) values ('%s', 'admin') "
        "on conflict (id) do update set role = 'admin';" % uid
    )
    code, body = call('POST', API + '/database/query', payload={'query': sql})
    print('profile -> HTTP', code, brief(body))
    sys.exit(0 if code < 400 else 1)

if cmd == 'delete':
    uid = get_id()
    if not uid:
        print('nothing to delete')
        sys.exit(0)
    code, body = call('DELETE', API + '/auth/users/' + uid)
    print('delete -> HTTP', code, brief(body) if code >= 400 else 'removed ' + uid)
    sys.exit(0 if code < 400 else 1)

print('unknown cmd', cmd)
sys.exit(2)
