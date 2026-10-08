"""Add Cairo fallback to font stacks in global.css."""

import io
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

p = 'src/styles/global.css'
s = io.open(p, encoding='utf-8').read()
pairs = [
    ("--font-sans: 'Inter', -apple-system", "--font-sans: 'Inter', 'Cairo', -apple-system"),
    ("--font-display: 'Inter', -apple-system", "--font-display: 'Inter', 'Cairo', -apple-system"),
]
n = 0
for a, b in pairs:
    if a in s:
        s = s.replace(a, b, 1)
        n += 1
    else:
        print('MISS:', a)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('replacements:', n)
