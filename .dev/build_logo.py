"""Write the icon-only logo (mark group, no wordmark) to public/logo.svg
plus src/components/Logo/Logo.jsx with the tight icon viewBox."""
import io

SRC = r'C:\Users\hp\OneDrive\Desktop\Al Balqan Logo Black.svg'
SVG_DST = r'public\logo.svg'
JSX_DST = r'src\components\Logo\Logo.jsx'
ICON_VB = '5.2 8.3 107.44 134'

src = io.open(SRC, encoding='utf-8').read()
group = src[src.index('<g'):src.index('</g>') + len('</g>')]

svg_out = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s">\n%s\n</svg>\n'
    % (ICON_VB, group)
)
io.open(SVG_DST, 'w', encoding='utf-8', newline='\n').write(svg_out)

jsx_out = """export default function Logo({ className = '' }) {
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
""" % (ICON_VB, group.replace('\n\t\t', '\n      ').replace('\n\t', '\n      '))
io.open(JSX_DST, 'w', encoding='utf-8', newline='\n').write(jsx_out)

import xml.etree.ElementTree as ET

root = ET.fromstring(svg_out)
ns = '{http://www.w3.org/2000/svg}'
assert len(root.findall(ns + 'g')) == 1, 'expected 1 group (icon only)'
print('written', SVG_DST, len(svg_out), 'chars | group paths:', group.count('<path'))
print('written', JSX_DST, len(jsx_out), 'chars')
