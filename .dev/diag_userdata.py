"""Verify the user_data / access_logs tables and log_access function exist."""
import json
import os
import urllib.request

REF = 'emwnetcjshdyvpkiiesp'
API = 'https://api.supabase.com/v1/projects/' + REF
SB = os.environ['SB_TOKEN']


def query(sql):
    req = urllib.request.Request(
        API + '/database/query',
        data=json.dumps({'query': sql}).encode('utf-8'),
        headers={'Authorization': 'Bearer ' + SB, 'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read().decode('utf-8', 'replace'))
    except Exception as e:
        return 0, str(e)


checks = [
    ("select table_name from information_schema.tables where table_schema='public' and table_name in ('user_data','access_logs') order by 1",
     'tables'),
    ("select column_name from information_schema.columns where table_schema='public' and table_name='user_data' order by ordinal_position",
     'user_data columns'),
    ("select column_name from information_schema.columns where table_schema='public' and table_name='access_logs' order by ordinal_position",
     'access_logs columns'),
    ("select proname from pg_proc where proname='log_access'",
     'log_access fn'),
    ("select count(*) as n from public.user_data",
     'user_data rows'),
    ("select count(*) as n from public.access_logs",
     'access_logs rows'),
]
for sql, label in checks:
    code, body = query(sql)
    print(label, '->', code, body if code != 200 else json.dumps(body)[:400])
