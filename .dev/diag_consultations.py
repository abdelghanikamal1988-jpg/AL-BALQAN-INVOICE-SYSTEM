"""Read-only diagnostics: current consultation_requests state, duplicate
detection by content fingerprint, and tombstone table presence.

Usage: $env:SB_TOKEN='sbp_...'; python .dev\diag_consultations.py
"""
import json
import os
import urllib.error
import urllib.request

REF = 'emwnetcjshdyvpkiiesp'
API = 'https://api.supabase.com/v1/projects/' + REF
SB = os.environ['SB_TOKEN']


def sql(query):
    req = urllib.request.Request(
        API + '/database/query',
        data=json.dumps({'query': query}).encode('utf-8'),
        headers={'Authorization': 'Bearer ' + SB, 'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode('utf-8', 'replace'))
    except urllib.error.HTTPError as e:
        return {'error': e.read().decode('utf-8', 'replace')[:400]}


print('== tombstone table ==')
print(json.dumps(sql(
    "select column_name, data_type from information_schema.columns "
    "where table_name='consultation_deleted' order by ordinal_position"
), indent=1)[:500])

print('== row counts ==')
print(json.dumps(sql(
    "select (select count(*) from public.consultation_requests) as requests, "
    "(select count(*) from public.consultation_deleted) as tombstones"
), indent=1)[:400])

print('== all rows (id order) ==')
rows = sql(
    "select id, netlify_id, full_name, phone, email, service, country, "
    "submitted_at, created_at, status, notes "
    "from public.consultation_requests order by created_at"
)
print(json.dumps(rows, indent=1, ensure_ascii=False)[:6000])

print('== duplicate fingerprints (name|phone|email, any gap) ==')
print(json.dumps(sql(
    "select lower(regexp_replace(coalesce(full_name,'') || '|' || coalesce(phone,'') "
    "|| '|' || coalesce(email,''), '\\s+', ' ', 'g')) as fp, count(*) as n, "
    "min(created_at) as first_at, max(created_at) as last_at "
    "from public.consultation_requests group by 1 having count(*) > 1 order by n desc"
), indent=1, ensure_ascii=False)[:3000])
