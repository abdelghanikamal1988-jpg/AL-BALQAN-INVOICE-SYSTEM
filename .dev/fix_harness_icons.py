import re
import os

src = open('src/components/Icons/Icon.jsx', encoding='utf-8').read()
body = src.split('const PATHS = {', 1)[1].split('\n};', 1)[0]
entries = re.findall(r'\n  (\w+): \((.*?)\n  \),', body, re.S)
icons = {}
for name, frag in entries:
    inner = re.sub(r'^<>|</>$', '', frag.strip(), flags=re.S).strip()
    icons[name] = re.sub(r'\s+', ' ', inner)


def svg(name):
    return (
        '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        + icons[name]
        + '</svg>'
    )


mapping = {
    '\U0001F464': 'user',
    '\U0001F9FE': 'receipt',
    '\U0001F4CE': 'paperclip',
    '\U0001F512': 'lock',
    '\U0001F6C2': 'folder',
    '\U0001F514': 'bell',
    '\u23F3': 'clock',
    '\u270E': 'pencil',
    '\U0001F465': 'users',
    '\U0001F4DD': 'note',
    '\U0001F4B3': 'card',
    '\U0001F91D': 'userCheck',
}

total = 0
for f in sorted(os.listdir('.dev')):
    if not f.endswith('.html'):
        continue
    p = os.path.join('.dev', f)
    s = open(p, encoding='utf-8').read()
    orig = s
    n = 0
    for ch, ic in mapping.items():
        c = s.count(ch)
        if c:
            s = s.replace(ch, svg(ic))
            n += c
    if s != orig:
        open(p, 'w', encoding='utf-8').write(s)
        total += n
        print('updated', f, '-', n)
print('total replaced', total)
