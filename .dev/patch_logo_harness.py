"""Harnesse previews: make the brand spots match the app — full scaled
lockup in the sidebar/login, full + icon-only variant in the header, and
no separate AL BALQAN wordmark spans anywhere."""
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

svg_src = io.open(r'public\logo.svg', encoding='utf-8').read()
full_vb = re.search(r'viewBox="([^"]+)"', svg_src).group(1).strip()
full_inner = re.search(r'<svg[^>]*>(.*)</svg>', svg_src, re.S).group(1).strip()

src = io.open(SRC, encoding='utf-8').read()
icon_inner = src[src.index('<g'):src.index('</g>') + len('</g>')]
icon_inner = re.sub(r'\sfill="[^"]*"', '', icon_inner).strip()

full_svg = (
    '<svg viewBox="%s" fill="currentColor" aria-hidden="true" '
    'focusable="false">%s</svg>' % (full_vb, full_inner)
)
mark_svg = (
    '<svg viewBox="%s" fill="currentColor" aria-hidden="true" '
    'focusable="false">%s</svg>' % (ICON_VB, icon_inner)
)
header_svgs = (
    '<svg class="app-header__logo-full" viewBox="%s" fill="currentColor" '
    'aria-hidden="true" focusable="false">%s</svg>'
    '<svg class="app-header__logo-mark" viewBox="%s" fill="currentColor" '
    'aria-hidden="true" focusable="false">%s</svg>'
    % (full_vb, full_inner, ICON_VB, icon_inner)
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
    for cls, repl in (
        ('app-header__logo', header_svgs),
        ('sidebar__brand-logo', full_svg),
        ('login-brand__tile', full_svg),
    ):
        r = span_re(cls)
        counts[cls] = len(r.findall(t))
        t = r.sub(lambda m, repl=repl: m.group(1) + repl + m.group(3), t)
    # generic fallbacks (img or older inline svg shapes inside brand spans)
    t = re.sub(r'<img src="\.\./public/logo\.svg"[^>]*/>', full_svg, t)
    io.open(f, 'w', encoding='utf-8', newline='\n').write(t)
    print(f, 'names:', n_name, counts)

print('full viewBox:', full_vb, '| aspect:',
      round(float(full_vb.split()[2]) / float(full_vb.split()[3]), 2))
