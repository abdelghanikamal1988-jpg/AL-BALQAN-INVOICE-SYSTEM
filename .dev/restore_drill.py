"""Restore drill: replay the newest logical backup into a scratch table.

backup_db.py proves the dump matches the live counts. This proves the dump
is actually usable — every table in the newest backup is recreated from its
JSON rows in a scratch table, then compared against live by row count and by
a full content hash (md5 over every row). The scratch table is dropped
before and after, so the public schema is left untouched.

Usage:
  $env:SB_TOKEN='sbp_...'; python .dev\\restore_drill.py            # newest dump
  $env:SB_TOKEN='sbp_...'; python .dev\\restore_drill.py --dir <path>
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
OUT_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backups')
SCRATCH = 'restore_drill'
HASH = "md5(coalesce(string_agg(md5(t::text), '|' order by md5(t::text)), ''))"


def query(sql):
    req = urllib.request.Request(
        API,
        data=json.dumps({'query': sql}).encode('utf-8'),
        headers={'Authorization': 'Bearer ' + SB, 'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return 200, json.loads(r.read().decode('utf-8', 'replace'))
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'replace')


def q_ident(name):
    return '"' + name.replace('"', '""') + '"'


def latest_dir():
    if '--dir' in sys.argv:
        i = sys.argv.index('--dir')
        return sys.argv[i + 1]
    stamps = sorted(
        (d for d in os.listdir(OUT_ROOT) if os.path.isdir(os.path.join(OUT_ROOT, d))),
        reverse=True,
    )
    return os.path.join(OUT_ROOT, stamps[0])


def table_hash(schema_table):
    code, rows = query('select ' + HASH + ' as h from ' + schema_table + ' t')
    if code != 200:
        return 'ERR ' + str(rows)
    return rows[0]['h'] if rows else ''


def main():
    folder = latest_dir()
    if not folder:
        print('no dumps found in', OUT_ROOT)
        raise SystemExit(1)
    print('restore drill:', folder)

    query('drop table if exists public.' + SCRATCH)

    names = [n[:-5] for n in sorted(os.listdir(folder)) if n.endswith('.json') and n != 'manifest.json']
    failed = []
    for table in names:
        with io.open(os.path.join(folder, table + '.json'), encoding='utf-8') as f:
            dumped = json.load(f)

        code, res = query('create table public.' + SCRATCH + ' as select * from public.' + q_ident(table) + ' where false')
        if code != 200:
            failed.append(table + ' (create: ' + str(res)[:120] + ')')
            continue

        payload = json.dumps(dumped, ensure_ascii=False, default=str)
        tag = '$restore_' + table.replace('$', '') + '$'
        while tag in payload:
            tag += '_'
        code, res = query(
            'insert into public.' + SCRATCH
            + ' select * from jsonb_populate_recordset(null::public.' + SCRATCH + ', '
            + tag + payload + tag + '::jsonb)'
        )
        if code != 200:
            failed.append(table + ' (insert: ' + str(res)[:120] + ')')
            query('drop table if exists public.' + SCRATCH)
            continue

        code, res = query(
            'select (select count(*) from public.' + SCRATCH + ') as scratch,'
            ' (select count(*) from public.' + q_ident(table) + ') as live'
        )
        counts = res[0] if code == 200 and isinstance(res, list) else {}
        scratch_n = counts.get('scratch')
        live_n = counts.get('live')

        scratch_h = table_hash('public.' + SCRATCH)
        live_h = table_hash('public.' + q_ident(table))

        ok = scratch_n == len(dumped) == live_n and scratch_h == live_h
        if not ok:
            failed.append(
                '%s (dump=%s scratch=%s live=%s hash %s)' % (table, len(dumped), scratch_n, live_n, 'ok' if scratch_h == live_h else 'DIFF')
            )
        print('  %s %-28s rows=%-4s hash=%s' % ('OK  ' if ok else 'DIFF', table, scratch_n, 'ok' if scratch_h == live_h else 'DIFF'))

        query('drop table if exists public.' + SCRATCH)

    query('drop table if exists public.' + SCRATCH)
    print('restore drill:', 'PASS' if not failed else 'FAIL')
    for line in failed:
        print('  FAIL', line)
    raise SystemExit(0 if not failed else 1)


if __name__ == '__main__':
    main()
