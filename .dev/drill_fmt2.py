import io
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

FILES = ['src/styles/global.css', 'src/styles/invoice.css', 'src/styles/clients.css',
         'src/styles/dashboard.css', 'src/styles/admin.css', 'src/styles/responsive.css',
         'src/styles/theme.css', 'src/styles/sidebar.css']

QUERIES = [
    ('radius-sm token', r'--radius-sm:\s*[^;]+'),
    ('field gap8', r'[^{}]+\.field[^{}]*\{[^}]*gap:\s*8px[^}]*\}'),
    ('hist-filter gap', r'[^{}]*history-filters[^{}]*\{[^}]*gap[^}]*\}'),
    ('au 22px', r'[^{}]*\{[^}]*22px[^}]*\}'),
    ('font 11.5', r'[^{}]+\{[^}]*font-size:\s*11\.5px[^}]*\}'),
    ('font 14.5', r'[^{}]+\{[^}]*font-size:\s*14\.5px[^}]*\}'),
    ('font 10px', r'[^{}]+\{[^}]*font-size:\s*10px[^}]*\}'),
    ('table td font', r'[^{}]*(?:history-table|cl-table|db-inv|db-act|au-table)[^{}]*\{[^}]*font-size:[^}]*\}'),
    ('table th pad', r'[^{}]*(?:history-table|cl-table|db-inv|db-act|au-table)[^{}]*\{[^}]*padding:[^}]*\}'),
    ('table th font', r'[^{}]*\bth\b[^{}]*\{[^}]*font-size:[^}]*\}'),
    ('btn base', r'[^{}]*\.btn\s*\{[^}]*\}'),
    ('au-actions pad', r'[^{}]*au-actions[^{}]*\{[^}]*\}'),
    ('modal actions', r'[^{}]*modal__actions[^{}]*\{[^}]*\}'),
    ('cta radius', r'[^{}]*\{[^}]*\}'),
]

for f in FILES:
    s = io.open(f, encoding='utf-8').read()
    for label, pat in QUERIES:
        if label == 'cta radius':
            continue
        for m in re.finditer(pat, s):
            t = ' '.join(m.group(0).split())
            if len(t) > 260:
                t = t[:260] + '…'
            print('%-18s %-16s %s' % (f.split('/')[-1], label, t))
        print()

# 4px/5px radius context in global.css
print('=== global.css radius 4/5 context ===')
s = io.open('src/styles/global.css', encoding='utf-8').read()
for m in re.finditer(r'[^{}]*\{[^}]*border-radius:\s*(?:4px|5px|9\.6px)[^}]*\}', s):
    t = ' '.join(m.group(0).split())
    print(t[:230])
