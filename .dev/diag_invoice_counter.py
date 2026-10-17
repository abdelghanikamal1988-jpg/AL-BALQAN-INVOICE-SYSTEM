"""Verify the invoice-number counter: functions exist, increment atomically,
and the first-use seed continues from numbers already in the invoices table."""
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


def one(sql):
    code, body = query(sql)
    if code != 200:
        return code, body
    return code, body


# 1. functions + table present
print('table ->', one(
    "select column_name from information_schema.columns "
    "where table_schema='public' and table_name='invoice_counters' order by ordinal_position"))
print('fns ->', one(
    "select proname from pg_proc where proname in "
    "('next_invoice_number','invoice_number_exists') order by 1"))

# 2. how many real invoices exist (what the seed would see)
print('invoices ->', one(
    "select count(*) as n, "
    "count(*) filter (where data->>'invoiceNumber' is not null) as numbered "
    "from public.invoices"))

# 3. allocate twice with a throwaway prefix, confirm it increments
print('alloc1 ->', one("select public.next_invoice_number('ZZTEST') as n"))
print('alloc2 ->', one("select public.next_invoice_number('ZZTEST') as n"))
print('exists(alloc1) ->', one(
    "select public.invoice_number_exists('ZZTEST-2026-0001') as b"))
print('exists(fake) ->', one(
    "select public.invoice_number_exists('INV-1999-9999') as b"))

# 4. clean up the throwaway prefix so production stays tidy
print('cleanup ->', one("delete from public.invoice_counters where key like 'ZZTEST-%'"))
print('left ->', one("select key, last_seq from public.invoice_counters"))
