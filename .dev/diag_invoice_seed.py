"""Confirm the first-use seed continues from existing invoice numbers."""
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


print('existing numbers ->', query(
    "select data->>'invoiceNumber' as n, data->>'issueDate' as d "
    "from public.invoices order by 2"))

# Seed the real prefix for the first time; it must land past the existing max.
print('seed alloc ->', query("select public.next_invoice_number('INV') as n"))
print('second    ->', query("select public.next_invoice_number('INV') as n"))
print('counter   ->', query("select key, last_seq from public.invoice_counters"))
