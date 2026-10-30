"""Logical backup: dump every public table to JSON via the Management API.

The free Supabase plan ships no restorable physical backup (backups: [] and
PITR is paid), so this script is the safety net: it exports each table in the
public schema to .dev/backups/<timestamp>/<table>.json and prints counts, so
a restore is a matter of re-inserting the rows.

Usage:
  $env:SB_TOKEN='sbp_...'; python .dev\\backup_db.py            # full dump
  $env:SB_TOKEN='sbp_...'; python .dev\\backup_db.py --latest   # verify last dump
"""

import io
import json
import os
import sys
import time
import urllib.error
import urllib.request

REF = 'emwnetcjshdyvpkiiesp'
API = 'https://api.supabase.com/v1/projects/' + REF + '/database/query'
SB = os.environ['SB_TOKEN']
OUT_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backups')


def query(sql):
    req = urllib.request.Request(
        API,
        data=json.dumps({'query': sql}).encode('utf-8'),
        headers={'Authorization': 'Bearer ' + SB, 'Content-Type': 'application/json'},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode('utf-8', 'replace'))


def q_ident(name):
    return '"' + name.replace('"', '""') + '"'


def list_tables():
    rows = query(
        "select table_name from information_schema.tables "
        "where table_schema = 'public' and table_type = 'BASE TABLE' "
        "order by table_name"
    )
    return [r['table_name'] for r in rows]


def latest_dir():
    if not os.path.isdir(OUT_ROOT):
        return None
    stamps = sorted(
        (d for d in os.listdir(OUT_ROOT) if os.path.isdir(os.path.join(OUT_ROOT, d))),
        reverse=True,
    )
    return os.path.join(OUT_ROOT, stamps[0]) if stamps else None


def verify(folder):
    print('verifying dump:', folder)
    ok = True
    for name in sorted(os.listdir(folder)):
        if not name.endswith('.json') or name == 'manifest.json':
            continue
        table = name[:-5]
        with io.open(os.path.join(folder, name), encoding='utf-8') as f:
            dumped = len(json.load(f))
        live = query('select count(*) as n from public.' + q_ident(table))[0]['n']
        mark = 'OK  ' if dumped == live else 'DIFF'
        if dumped != live:
            ok = False
        print('  %s %-28s dump=%-6s live=%s' % (mark, table, dumped, live))
    print('verify:', 'PASS' if ok else 'FAIL')
    return ok


def main():
    if '--latest' in sys.argv:
        folder = latest_dir()
        if not folder:
            print('no dumps found in', OUT_ROOT)
            raise SystemExit(1)
        raise SystemExit(0 if verify(folder) else 1)

    folder = os.path.join(OUT_ROOT, time.strftime('%Y%m%d-%H%M%S'))
    os.makedirs(folder, exist_ok=True)

    tables = list_tables()
    manifest = {'project': REF, 'tables': {}}
    for table in tables:
        rows = query('select * from public.' + q_ident(table))
        with io.open(os.path.join(folder, table + '.json'), 'w', encoding='utf-8') as f:
            json.dump(rows, f, ensure_ascii=False, indent=1, default=str)
        manifest['tables'][table] = len(rows)
        print('  %-28s %s rows' % (table, len(rows)))

    with io.open(os.path.join(folder, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)

    total = sum(manifest['tables'].values())
    size = sum(
        os.path.getsize(os.path.join(folder, n)) for n in os.listdir(folder)
    )
    print('dump ->', folder)
    print('tables:', len(tables), 'rows:', total, 'bytes:', size)
    verify(folder)


if __name__ == '__main__':
    main()
