"""Extract the FULL logo (mark + AL BALQAN wordmark, both groups) from the
provided source SVG and write public/logo.svg plus the shared React Logo
component, normalizing every path fill so the mark inherits currentColor
(dark theme safe)."""
import io
import re

SRC = r'C:\Users\hp\OneDrive\Desktop\Al Balqan Logo Black.svg'
SVG_DST = r'public\logo.svg'
JSX_DST = r'src\components\Logo\Logo.jsx'
VIEWBOX = '0 0 465.1 146.9'

src = io.open(SRC, encoding='utf-8').read()
start = src.index('<g')
end = src.rindex('</g>') + len('</g>')
body = src[start:end]

n_fill = len(re.findall(r'\sfill="[^"]*"', body))
n_style = len(re.findall(r'\sstyle="[^"]*"', body))
n_stroke = len(re.findall(r'\sstroke="[^"]*"', body))
body = re.sub(r'\sfill="[^"]*"', '', body)
body = re.sub(r'\sstroke="[^"]*"', '', body)

svg_out = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s" fill="currentColor">\n%s\n</svg>\n'
    % (VIEWBOX, body)
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
""" % (VIEWBOX, body.replace('\n\t\t', '\n      ').replace('\n\t', '\n      '))
io.open(JSX_DST, 'w', encoding='utf-8', newline='\n').write(jsx_out)

print('fill attrs stripped:', n_fill, '| style attrs:', n_style, '| stroke attrs:', n_stroke)
print('groups:', body.count('<g'), 'paths:', body.count('<path'))
print('written', SVG_DST, len(svg_out), 'chars')
print('written', JSX_DST, len(jsx_out), 'chars')
