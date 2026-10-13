"""Extract the mark group (paths only, no wordmark) from the provided logo
SVG and write public/logo.svg plus the shared React LogoMark component."""
import io

SRC = r'C:\Users\hp\OneDrive\Desktop\Al Balqan Logo Black.svg'
SVG_DST = r'public\logo.svg'
JSX_DST = r'src\components\LogoMark\LogoMark.jsx'
VIEWBOX = '5.2 8.3 107.44 134'

src = io.open(SRC, encoding='utf-8').read()
start = src.index('<g>')
end = src.index('</g>', start) + len('</g>')
group = src[start:end]
inner = group[len('<g>'):-len('</g>')].strip('\n\t')

svg_out = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s">\n%s\n</svg>\n'
    % (VIEWBOX, group)
)
io.open(SVG_DST, 'w', encoding='utf-8', newline='\n').write(svg_out)

jsx_out = """export default function LogoMark({ className = '' }) {
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
""" % (VIEWBOX, inner.replace('\n\t\t', '\n      ').replace('\n\t', '\n      '))
io.open(JSX_DST, 'w', encoding='utf-8', newline='\n').write(jsx_out)

print('written', SVG_DST, len(svg_out), 'chars')
print('written', JSX_DST, len(jsx_out), 'chars, paths:', inner.count('<path'))
