import glob
import io
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

print('=== 42px sources ===')
for f in glob.glob('src/styles/*.css'):
    s = io.open(f, encoding='utf-8').read()
    for m in re.finditer(r'[^{}]+\{[^}]*42px[^}]*\}', s):
        print(f.split('\\')[-1], '=>', ' '.join(m.group(0).split())[:200])

print('\n=== h3 font-size 22 ===')
for f in glob.glob('src/styles/*.css'):
    s = io.open(f, encoding='utf-8').read()
    for m in re.finditer(r'[^{}]+\{[^}]*font-size:\s*22px[^}]*\}', s):
        print(f.split('\\')[-1], '=>', ' '.join(m.group(0).split())[:200])

print('\n=== bare td font-size ===')
for f in glob.glob('src/styles/*.css'):
    s = io.open(f, encoding='utf-8').read()
    for m in re.finditer(r'[^{}]*\btd\b[^{}]*\{[^}]*font-size:[^}]*\}', s):
        t = ' '.join(m.group(0).split())
        print(f.split('\\')[-1], '=>', t[:200])

print('\n=== admin.css @media block ===')
s = io.open('src/styles/admin.css', encoding='utf-8').read()
m = re.search(r'@media[^{]+\{', s)
if m:
    start = m.end() - 1
    depth = 0
    i = start
    while i < len(s):
        if s[i] == '{':
            depth += 1
        elif s[i] == '}':
            depth -= 1
            if depth == 0:
                break
        i += 1
    print(' '.join(s[m.start():i + 1].split()))

print('\n=== harness inline styles touching page-header h1 ===')
for f in glob.glob('.dev/preview-*.html'):
    s = io.open(f, encoding='utf-8').read()
    for m in re.finditer(r'<style[^>]*>([\s\S]*?)</style>', s):
        if 'page-header h1' in m.group(1) or 'h1 {' in m.group(1):
            print(f, '=>', ' '.join(m.group(1).split())[:300])

print('\n=== --fs-title definition ===')
s = io.open('src/styles/theme.css', encoding='utf-8').read()
m = re.search(r'--fs-title:[^;]+;', s)
print(m.group(0) if m else 'NOT FOUND in theme.css')
s = io.open('src/styles/global.css', encoding='utf-8').read()
for m in re.finditer(r'--fs-title:[^;]+;', s):
    print('global:', m.group(0))
