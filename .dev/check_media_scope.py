import re

path = r'src\styles\responsive.css'
src = open(path, encoding='utf-8').read()
lines = src.split('\n')

stack = []          # (media_query_or_None, open_line)
ranges = []
for i, ln in enumerate(lines, 1):
    for m in re.finditer(r'@media[^{]*', ln):
        stack.append((m.group(0).strip(), i))
    for ch in ln:
        if ch == '{':
            if not stack:
                stack.append((None, i))
        elif ch == '}':
            if stack:
                stack.pop()

# report media ranges properly
stack = []
out = []
depth = 0
cur_media = []
for i, ln in enumerate(lines, 1):
    for m in re.finditer(r'@media\s*([^{]+)\{', ln):
        cur_media.append((m.group(1).strip(), i))
    opens = ln.count('{')
    closes = ln.count('}')
    for _ in range(opens):
        depth += 1
    for _ in range(closes):
        depth -= 1
        if cur_media and depth == len(cur_media) - 1:
            mq, start = cur_media.pop()
            out.append((start, i, mq))

print('total lines:', len(lines), 'final depth:', depth)
for s, e, mq in out:
    print(f'  L{s}-L{e}: @media {mq}')

# locate markers of this session's rules and their enclosing media
markers = [
    'flex: 0 0 100%',
    'overflow-wrap: anywhere',
    '-webkit-line-clamp: 4',
    'justify-self: start',
    'grid-column: auto;',
]
for i, ln in enumerate(lines, 1):
    if any(mk in ln for mk in markers):
        enc = [mq for s, e, mq in out if s <= i <= e]
        print(f'  L{i}: {ln.strip()[:60]}  -> {enc}')
