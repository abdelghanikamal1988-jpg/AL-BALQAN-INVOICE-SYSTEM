import glob
import io
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

print('== avatar ==')
s = io.open('src/styles/global.css', encoding='utf-8').read()
for m in re.finditer(r'[^{}]*avatar[^{}]*\{[^}]*\}', s):
    print(' '.join(m.group(0).split())[:200])

print('== statc padding 11px ==')
for f in glob.glob('src/styles/*.css'):
    t = io.open(f, encoding='utf-8').read()
    for m in re.finditer(r'[^{}]+\{[^}]*11px 10px[^}]*\}', t):
        print(f, '=>', ' '.join(m.group(0).split())[:200])

print('== .field label rules in global ==')
for m in re.finditer(r'[^{}]*\.field label[^{}]*\{[^}]*\}', s):
    print(' '.join(m.group(0).split())[:220])

print('== 9.6px count ==')
tot = 0
for f in glob.glob('src/styles/*.css'):
    t = io.open(f, encoding='utf-8').read()
    c = t.count('9.6px')
    tot += c
    if c:
        print(f, c)
print('total', tot)

print('== clients actions markup ==')
t = io.open('.dev/preview-clients.html', encoding='utf-8').read()
i = t.find('cl-table')
seg = t[i:i + 8000]
m = re.search(r'<td class="cl-actions"[\s\S]{0,300}', seg)
if not m:
    m = re.search(r'<td[^>]*>[\s\S]{0,120}btn[\s\S]{0,200}', seg)
print(m.group(0)[:420] if m else 'not found')
print('cl-actions in seg:', 'cl-actions' in seg)

print('== history actions td ==')
t = io.open('.dev/preview-history.html', encoding='utf-8').read()
m = re.search(r'<td class="actions-cell"[\s\S]{0,200}', t)
print(m.group(0)[:300] if m else 'not found')

print('== au actions td ==')
t = io.open('.dev/preview-admin.html', encoding='utf-8').read()
m = re.search(r'<td class="au-actions"[\s\S]{0,160}', t)
print(m.group(0)[:300] if m else 'not found')
