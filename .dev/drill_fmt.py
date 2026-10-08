import io
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

PATS = [
    ('16.77|105%', r'(font-size[^;{}]*105%[^;]*;|font-size:[^;{}]*105%)'),
    ('radius 9.6/0.6', r'[^;{}]*border-radius[^;{}]*(9\.6|0\.6rem|\.6rem)[^;{}]*'),
    ('radius 5px', r'[^;{}]*border-radius:[^;{}]*\b5px\b[^;{}]*'),
    ('radius 4px', r'[^;{}]*border-radius:[^;{}]*\b4px\b[^;{}]*'),
    ('label -1px', r'[^{}]*label[^{}]*\{[^}]*margin[^}]*-1px[^}]*\}'),
    ('history input h', r'\.history-filters__field[^{}]*\{[^}]*\}'),
    ('cta', r'\.app-header__cta[^{}]*\{[^}]*\}'),
    ('btn--block', r'\.btn--block[^{}]*\{[^}]*\}|\.login-card[^{}]*btn[^{}]*\{[^}]*\}'),
    ('icon-btn base', r'\.icon-btn\s*\{[^}]*\}'),
    ('btn--sm base', r'\.btn--sm\s*\{[^}]*\}'),
    ('h1 21', r'[^{}]*page-header h1[^{}]*\{[^}]*font-size:[^;]*21px[^;]*;[^}]*\}'),
    ('modal hdr 22', r'[^{}]*modal__header[^{}]*\{[^}]*22px[^}]*\}'),
    ('au modal btn 42', r'\.au-modal[^{}]*btn[^{}]*\{[^}]*\}'),
    ('field label', r'\.field label\s*\{[^}]*\}'),
    ('field base', r'\.field\s*\{[^}]*\}'),
    ('12.5px td', r'[^{}]*td[^{}]*\{[^{}]*font-size:[^;]*12\.5px[^;]*;[^{}]*\}'),
]

FILES = ['src/styles/global.css', 'src/styles/invoice.css', 'src/styles/clients.css',
         'src/styles/dashboard.css', 'src/styles/admin.css', 'src/styles/responsive.css',
         'src/styles/theme.css', 'src/styles/sidebar.css']

for f in FILES:
    s = io.open(f, encoding='utf-8').read()
    for label, pat in PATS:
        for m in re.finditer(pat, s):
            txt = ' '.join(m.group(0).split())
            if len(txt) > 240:
                txt = txt[:240] + '…'
            print('%-24s %-14s %s' % (f.split('/')[-1], label, txt))

# where is font-size 16.77-ish: search computed source in JSX/CSS for % font-size
print('\n--- font-size with % ---')
for f in FILES + ['src/pages/Dashboard/Dashboard.jsx']:
    try:
        s = io.open(f, encoding='utf-8').read()
    except Exception:
        continue
    for m in re.finditer(r'font-size:\s*[^;{}]*%', s):
        print(f, '=>', ' '.join(m.group(0).split()))

# h1 phone rules
print('\n--- page-header h1 font-size rules ---')
for f in FILES:
    s = io.open(f, encoding='utf-8').read()
    for m in re.finditer(r'[^{}]+page-header h1[^{}]*\{[^}]*\}', s):
        print(f, '=>', ' '.join(m.group(0).split())[:220])

# btn--sm / icon-btn variants heights sources
print('\n--- btn--sm rules ---')
for f in FILES:
    s = io.open(f, encoding='utf-8').read()
    for m in re.finditer(r'[^{}]*btn--sm[^{}]*\{[^}]*\}', s):
        t = ' '.join(m.group(0).split())
        if 'padding' in t or 'min-height' in t or 'height' in t:
            print(f, '=>', t[:220])
