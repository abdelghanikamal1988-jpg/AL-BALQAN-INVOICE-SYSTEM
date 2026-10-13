"""Harnesse previews: make sure the brand spots carry the FULL inline logo
(mark + wordmark) and no separate AL BALQAN wordmark spans."""
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

svg_src = io.open(r'public\logo.svg', encoding='utf-8').read()
inner = re.search(r'<svg[^>]*>(.*)</svg>', svg_src, re.S).group(1).strip()
inline = (
    '<svg viewBox="0 0 465.1 146.9" fill="currentColor" aria-hidden="true" '
    'focusable="false">%s</svg>' % inner
)

old_icon_re = re.compile(
    r'<svg viewBox="5\.2 8\.3 107\.44 134"[^>]*>.*?</svg>', re.S
)
img_re = re.compile(r'<img src="\.\./public/logo\.svg"[^>]*/>')
name_re = re.compile(
    r'\s*<span class="(?:sidebar__brand-name|app-header__brand-word|login-brand__name)">[^<]*</span>'
)

for f in FILES:
    t = io.open(f, encoding='utf-8').read()
    n_old = len(old_icon_re.findall(t))
    n_img = len(img_re.findall(t))
    n_name = len(name_re.findall(t))
    t = old_icon_re.sub(lambda m: inline, t)
    t = img_re.sub(lambda m: inline, t)
    t = name_re.sub('', t)
    io.open(f, 'w', encoding='utf-8', newline='\n').write(t)
    print(f, 'old-icons:', n_old, 'imgs:', n_img, 'names:', n_name)
