import re
import time
import urllib.request

BASE = 'https://abdelghanikamal1988-jpg.github.io/AL-BALQAN-INVOICE-SYSTEM/'
JS = 'index-BmxcX_Fh.js'
CSS = 'index-B5i1g_Gm.css'


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read().decode('utf-8', 'replace')


html = ''
for _ in range(30):
    try:
        html = get(BASE)
    except Exception as e:
        print('retry fetch:', e)
        time.sleep(5)
        continue
    if JS in html and CSS in html:
        break
    time.sleep(5)
else:
    found = sorted(set(re.findall(r'assets/index-[^"\' ]+', html)))
    raise SystemExit(f'FAIL: live index still old bundle: {found}')

css = get(BASE + 'assets/' + CSS)
js = get(BASE + 'assets/' + JS)
s = re.sub(r'\s+', '', css).lower()
jl = js.lower()

checks = []


def chk(name, cond, extra=''):
    checks.append((name, bool(cond), extra))


chk('index -> new js bundle', JS in html)
chk('index -> new css bundle', CSS in html)
chk('css: --on-brand token', '--on-brand:#f' in s)
chk('css: brand ink', '--brand:#141414' in s)
chk('css: no green brand token', '--brand:#22c55e' not in s)
chk('css: brand-tint site mist', '--brand-tint:#eff4f7' in s)
chk('css: muted site ash', '--muted:#555555' in s)
chk('css: ground site ice', '--ground:#f4f9f9' in s)
chk('css: text site ink', '--text:#141414' in s)
chk('css: old green text gone', '--text:#16211b' not in s)
chk('css: old login slate gone', '#111827' not in s and '#1f2937' not in s)
chk('css: login page black', 'background-color:#000' in s)
chk('css: login card ink', '#1f2937' not in s and '.login-card{' in s)
chk('css: dark accent light', '--brand:#f4f9f9' in s)
chk('js: donut ink track grey', 'conic-gradient(#141414' in jl and '#e6e6e6' in jl)
chk('js: no chart green', '22c55e' not in jl)
chk('css: status green kept (funnel approved)', 'background:#22c55e' in s)

failed = [c for c in checks if not c[1]]
for name, ok, extra in checks:
    print(('PASS ' if ok else 'FAIL ') + name + ((' | ' + str(extra)) if extra else ''))
print('===', 'ALL PASS' if not failed else f'{len(failed)} FAILED', f'({len(checks)} checks)')
if failed:
    raise SystemExit(1)
