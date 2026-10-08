import glob
import io

for f in ['src/i18n/en/shell.js', 'src/i18n/ar/shell.js']:
    for line in io.open(f, encoding='utf-8'):
        if 'search' in line.lower() and 'laceholder' in line:
            print(f, repr(line.strip()))

raw = open('.dev/preview-dashboard.html', 'rb').read()
i = raw.find(b'placeholder')
print('harness:', raw[i:i + 60])
print('has charset utf-8:', (b'charset=utf-8' in raw) or (b'charset="utf-8"' in raw))

for f in sorted(glob.glob('.dev/preview-*.html')):
    h = open(f, encoding='utf-8').read()
    comps = [c for c in ['CreateInvoice', 'InvoiceHistory', 'ClientDetail', 'AdminUsers',
                         'ClientForm', 'Clients', 'Dashboard'] if c in h]
    print(f, len(h), comps)
