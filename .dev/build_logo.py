"""Build the lockup with the WORDMARK scaled so its height equals the icon
height (user request): scale group 2 by 134/55.02 anchored at its bottom-left
(keeps the original gap and baseline), tighten the viewBox, and emit
public/logo.svg + src/components/Logo/Logo.jsx (full) and LogoMark.jsx (icon
only, for the phone header variant)."""
import io
import re

SRC = r'C:\Users\hp\OneDrive\Desktop\Al Balqan Logo Black.svg'
SVG_DST = r'public\logo.svg'
JSX_FULL = r'src\components\Logo\Logo.jsx'
JSX_MARK = r'src\components\Logo\LogoMark.jsx'

ICON_VB = '5.2 8.3 107.44 134'
ICON = (5.2, 8.3, 107.43, 134.0)
WORD = (143.26, 87.19, 315.04, 55.02)

s = ICON[3] / WORD[3]
tx = WORD[0] * (1 - s)
ty = (WORD[1] + WORD[3]) * (1 - s)
word_right = WORD[0] + WORD[2] * s
union_top = min(ICON[1], WORD[1] * s + ty)
union_bottom = max(ICON[1] + ICON[3], (WORD[1] + WORD[3]) * s + ty)
vb = '%s %.2f %.2f %.2f' % (
    ICON[0], union_top, word_right - ICON[0], union_bottom - union_top
)

src = io.open(SRC, encoding='utf-8').read()
g_parts = src.split('<g')
assert len(g_parts) == 3, 'expected exactly two groups, got %d' % (len(g_parts) - 1)
first_g = src[src.index('<g'):src.index('</g>') + len('</g>')]
body = src[src.index('<g'):src.rindex('</g>') + len('</g>')]

groups = body.split('<g')
groups[2] = ' transform="translate(%.2f %.2f) scale(%s)"' % (
    tx, ty, format(s, '.6f')
) + groups[2]
body_scaled = '<g'.join(groups)

svg_out = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s" fill="currentColor">\n%s\n</svg>\n'
    % (vb, body_scaled)
)
io.open(SVG_DST, 'w', encoding='utf-8', newline='\n').write(svg_out)


def emit(path, name, viewbox, content):
    jsx = """export default function %s({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="%s"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      %s
    </svg>
  );
}
""" % (name, viewbox, content.replace('\n\t\t', '\n      ').replace('\n\t', '\n      '))
    io.open(path, 'w', encoding='utf-8', newline='\n').write(jsx)
    print('written', path, len(jsx), 'chars')


emit(JSX_FULL, 'Logo', vb, body_scaled)
emit(JSX_MARK, 'LogoMark', ICON_VB, first_g)

import xml.etree.ElementTree as ET

root = ET.fromstring(svg_out)
ns = '{http://www.w3.org/2000/svg}'
groups_out = root.findall(ns + 'g')
assert len(groups_out) == 2, 'expected 2 groups in output, got %d' % len(groups_out)
assert groups_out[1].get('transform'), 'group 2 missing transform'

print('scale:', round(s, 6), '| translate:', round(tx, 2), round(ty, 2))
print('viewBox:', vb, '| aspect:', round((word_right - ICON[0]) / (union_bottom - union_top), 2))
print('groups:', body_scaled.count('<g'), 'paths:', body_scaled.count('<path'))
print('written', SVG_DST, len(svg_out), 'chars')
