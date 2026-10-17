"""Run a read-only SQL query through the Supabase Management API.

Usage:
  $env:SB_TOKEN='sbp_...'; python .dev\\query_sql.py "select ..."
  $env:SB_TOKEN='sbp_...'; python .dev\\query_sql.py path\\to\\file.sql
"""
import io
import json
import os
import sys
import urllib.error
import urllib.request

REF = 'emwnetcjshdyvpkiiesp'
API = 'https://api.supabase.com/v1/projects/' + REF + '/database/query'
SB = os.environ['SB_TOKEN']

arg = sys.argv[1] if len(sys.argv) > 1 else ''
if os.path.isfile(arg):
    sql = io.open(arg, encoding='utf-8').read()
else:
    sql = arg

req = urllib.request.Request(
    API,
    data=json.dumps({'query': sql}).encode('utf-8'),
    headers={'Authorization': 'Bearer ' + SB, 'Content-Type': 'application/json'},
    method='POST',
)
try:
    with urllib.request.urlopen(req, timeout=90) as r:
        body = r.read().decode('utf-8', 'replace')
        print(body)
except urllib.error.HTTPError as e:
    print('HTTP', e.code)
    print(e.read().decode('utf-8', 'replace'))
