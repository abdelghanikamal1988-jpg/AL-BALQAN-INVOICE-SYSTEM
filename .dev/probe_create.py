import io
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

src = io.open('src/pages/CreateInvoice/CreateInvoice.jsx', encoding='utf-8').read()
cls = sorted(set(sum([re.findall(r"className=[\"{`]([^\"`}]+)", src)], [])))
print('classes:')
for c in cls:
    print('  ', c[:110])

resp = io.open('src/styles/responsive.css', encoding='utf-8').read()
inv = [l.strip() for l in resp.splitlines()
       if any(k in l.lower() for k in ('invoice', 'items', 'table', 'form'))]
print('responsive invoice/items/table rules:', len(inv))
for l in inv[:30]:
    print('  ', l[:130])
