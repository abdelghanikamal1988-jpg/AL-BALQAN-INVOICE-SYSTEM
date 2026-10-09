"""Round 3 harness patch: carousel rows + prev/next arrows in preview-dashboard.html.

Idempotent: skips work when .db-cardnav is already present.
"""

import io
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

PATH = '.dev/preview-dashboard.html'

CHEV = ('<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'
        '<path d="M9.5 5.5L16 12l-6.5 6.5" /></svg>')

SCRIPT = '''
<script>
  document.querySelectorAll('.db-panel').forEach(function (panel) {
    var nav = panel.querySelector('.db-cardnav');
    var rows = panel.querySelectorAll('.db-inv tbody tr');
    if (!nav) return;
    if (rows.length < 2) { nav.parentNode.removeChild(nav); return; }
    var i = 0;
    var idx = nav.querySelector('.db-cardnav__idx');
    var prev = nav.querySelector('.db-cardnav__btn--prev');
    var next = nav.querySelector('.db-cardnav__btn--next');
    function show(n) {
      i = (n + rows.length) % rows.length;
      Array.prototype.forEach.call(rows, function (r, k) {
        r.classList.toggle('is-active', k === i);
      });
      idx.textContent = (i + 1) + ' / ' + rows.length;
    }
    prev.addEventListener('click', function () { show(i - 1); });
    next.addEventListener('click', function () { show(i + 1); });
    show(0);
  });
</script>
'''

html = io.open(PATH, encoding='utf-8').read()

if 'db-cardnav' in html:
    print('already patched')
    raise SystemExit(0)

out = []
pos = 0
panels = 0
navs = 0

pattern = re.compile(r'<section class="card db-panel".*?</section>', re.S)
for m in pattern.finditer(html):
    block = m.group(0)
    if 'table class="db-inv"' not in block:
        continue
    label = re.search(r'aria-label="([^"]*)"', block)
    label = label.group(1) if label else 'Table'

    block2, n = re.subn(r'(<tbody>\s*)(<tr\b)', r'\1<tr class="is-active"', block, count=1)
    if n == 0:
        print('!! no tbody row in panel', label)
        continue

    raw = block2[:block2.rfind('</section>')]
    head = raw.rstrip(' ')
    sec_ind = raw[len(head):]
    nav_ind = sec_ind + '  '
    lines = [
        nav_ind + '<div class="db-cardnav" role="group" aria-label="' + label + '">',
        nav_ind + '  <button type="button" class="db-cardnav__btn db-cardnav__btn--prev" '
                 'aria-label="Previous">' + CHEV + '</button>',
        nav_ind + '  <span class="db-cardnav__idx" aria-live="polite">1 / 1</span>',
        nav_ind + '  <button type="button" class="db-cardnav__btn db-cardnav__btn--next" '
                 'aria-label="Next">' + CHEV + '</button>',
        nav_ind + '</div>',
    ]
    block2 = head + '\n'.join(lines) + '\n' + sec_ind + '</section>'

    out.append(html[pos:m.start()])
    out.append(block2)
    pos = m.end()
    panels += 1
    navs += 1

out.append(html[pos:])
html = ''.join(out)

if 'document.querySelectorAll(\'.db-panel\')' not in html:
    html = html.replace('</body>', SCRIPT + '</body>')

io.open(PATH, 'w', encoding='utf-8', newline='\n').write(html)
print('patched panels=%d navs=%d script=%s'
      % (panels, navs, 'db-cardnav' in html and 'classList.toggle' in html))
