import re, os

css = open(os.path.join(os.environ['TEMP'], 'opencode', 'nexus-app-fresh.css'), encoding='utf-8', errors='ignore').read()
pos = 0
n = len(css)
stack = []
out = []
tokre = re.compile(r'[{}]')
while pos < n:
    m = tokre.search(css, pos)
    if not m:
        break
    tok = m.group(0)
    seg = css[pos:m.start()]
    if tok == '{':
        stack.append(seg.strip()[:220])
        pos = m.end()
    else:
        decl = seg
        if re.search(r'border-radius:\s*(12px|\.75rem)', decl):
            out.append((' > '.join(x for x in stack if x), decl[:300].replace('\n', ' ')))
        if stack:
            stack.pop()
        pos = m.end()

print('hits:', len(out))
for s, d in out:
    if '.card' in s or 'card' in d:
        print('SEL:', s[-300:])
        print('  DECL:', d[:300])
        print('==')
