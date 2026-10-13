"""Harnesse previews: brand spots carry the ICON-only logo (no wordmark),
matching the app."""
import io
import re

FILES = [
    r'.dev\preview-shell.html',
    r'.dev\preview-shell-drawer.html',
    r'.dev\preview-dashboard.html',
    r'.dev\preview-header.html',
    r'.dev\preview-pending.html',
    r'.dev\preview-login.html',
]
SRC = r'C:\Users\hp\OneDrive\Desktop\Al Balqan Logo Black.svg'
ICON_VB = '5.2 8.3 107.44 134'

src = io.open(SRC, encoding='utf-8').read()
inner = src[src.index('<g'):src.index('</g>') + len('</g>')]
inner = re.sub(r'\sfill="[^"]*"', '', inner).strip()

icon_svg = (
    '<svg viewBox="%s" fill="currentColor" aria-hidden="true" '
    'focusable="false">%s</svg>' % (ICON_VB, inner)
)

name_re = re.compile(
    r'\s*<span class="(?:sidebar__brand-name|app-header__brand-word|login-brand__name)">[^<]*</span>'
)

def span_re(cls):
    return re.compile(r'(<span class="%s">)(.*?)(</span>)' % cls, re.S)

for f in FILES:
    t = io.open(f, encoding='utf-8').read()
    n_name = len(name_re.findall(t))
    t = name_re.sub('', t)
    counts = {}
    for cls in ('app-header__logo', 'sidebar__brand-logo', 'login-brand__tile'):
        r = span_re(cls)
        counts[cls] = len(r.findall(t))
        t = r.sub(lambda m: m.group(1) + icon_svg + m.group(3), t)
    t = re.sub(r'<img src="\.\./public/logo\.svg"[^>]*/>', icon_svg, t)
    io.open(f, 'w', encoding='utf-8', newline='\n').write(t)
    print(f, 'names:', n_name, counts)
