"""Check i18n keys, Icon names, img tags without loading=lazy, input attrs."""

import io
import glob
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

print('--- i18n files')
files = glob.glob('src/i18n/*') + glob.glob('src/locales/*') + glob.glob('src/lang/*') + glob.glob('src/**/en*.js*', recursive=True)
files = sorted(set(f for f in files if f.endswith(('.js', '.jsx', '.json')) and 'node_modules' not in f))
print(files[:10])

for f in files:
    s = io.open(f, encoding='utf-8').read()
    if len(s) < 100000 and ('close' in s or 'filter' in s):
        print('=====', f)
        for k in ['close', 'filters', 'loadMore', 'showMore', 'showFilters']:
            for m in list(re.finditer(k, s))[:3]:
                i = m.start()
                print('   [%s]' % k, ' '.join(s[max(0, i - 50):i + 70].split())[:130])

print()
print('--- Icon names')
s = io.open('src/components/Icons/Icon.jsx', encoding='utf-8').read()
names = sorted(set(re.findall(r"case '([A-Za-z0-9]+)'", s)))
print(names)

print()
print('--- imgs without loading')
for f in glob.glob('src/**/*.jsx', recursive=True):
    t = io.open(f, encoding='utf-8').read()
    for m in re.finditer(r'<img[^>]*?>', t, re.S):
        tag = ' '.join(m.group(0).split())
        if 'loading' not in tag:
            print('NO-LAZY', f, tag[:170])

print()
print('--- inputmode/autocomplete/type usage')
for f in ['src/pages/Login/Login.jsx', 'src/pages/AdminUsers/AdminUsers.jsx',
          'src/pages/CreateInvoice/CreateInvoice.jsx', 'src/components/SearchBar/SearchBar.jsx']:
    t = io.open(f, encoding='utf-8').read()
    print(f, '| inputMode:', len(re.findall(r'inputMode', t)),
          '| autoComplete:', len(re.findall(r'autoComplete', t)),
          '| type=search:', len(re.findall(r'type="search"', t)),
          '| type=number:', len(re.findall(r'type="number"', t)))
    for m in list(re.finditer(r'<input[^>]*?>', t, re.S))[:8]:
        print('   ', ' '.join(m.group(0).split())[:150])
