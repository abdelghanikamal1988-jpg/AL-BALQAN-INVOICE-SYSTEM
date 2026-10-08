"""Patch preview harnesses: swap the old topbar for the new Nexus navbar.

Dev-only helper — regenerates the static <header class="app-header"> block in
every .dev/preview-*.html so the harnesses mirror Header.jsx markup, and
ensures the shell harness has the expanded-rail state + a demo toggle.
"""

import glob
import os
import re


def icon(inner, width="1.6"):
    return (
        '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        f'stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round">{inner}</svg>'
    )


MENU = icon('<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>')
SEARCH = icon('<circle cx="11" cy="11" r="7.5"/><path d="M20.5 20.5l-4.4-4.4"/>')
PLUS = icon('<path d="M12 5v14"/><path d="M5 12h14"/>', "1.7")
MAXIMIZE = icon(
    '<path d="M8.5 3.5H5.5a2 2 0 0 0-2 2v3"/>'
    '<path d="M15.5 3.5h3a2 2 0 0 1 2 2v3"/>'
    '<path d="M8.5 20.5H5.5a2 2 0 0 1-2-2v-3"/>'
    '<path d="M15.5 20.5h3a2 2 0 0 0 2-2v-3"/>'
)
BELL = icon(
    '<path d="M18 8.6a6 6 0 1 0-12 0c0 5.4-2.2 7-2.2 7h16.4s-2.2-1.6-2.2-7"/>'
    '<path d="M13.8 19a2 2 0 0 1-3.6 0"/>'
)
CHEVRON = icon('<path d="M5.5 9.5L12 16l6.5-6.5"/>').replace(
    'class="icon"', 'class="icon app-header__ucharv"'
)

HEADER = f'''<header class="app-header no-print">
      <div class="app-header__inner">
        <button type="button" class="app-header__menu" aria-label="Close navigation" aria-expanded="true" aria-controls="app-sidebar">
          {MENU}
        </button>

        <a href="#" class="app-header__brand" aria-label="AL BALQAN home">
          <span class="app-header__logo">
            <img src="../public/logo.svg" alt="AL BALQAN logo" />
          </span>
          <span class="app-header__brand-word">AL BALQAN</span>
        </a>

        <form class="topsearch" role="search" onsubmit="return false;">
          <span class="topsearch__addon" aria-hidden="true">{SEARCH}</span>
          <input class="topsearch__input" type="search" placeholder="Search clients, invoices…" aria-label="Search" />
          <kbd class="topsearch__hint" aria-hidden="true">/</kbd>
        </form>

        <div class="app-header__right">
          <div class="app-header__dd">
            <button type="button" class="app-header__cta">
              {PLUS}
              New
            </button>
          </div>

          <button type="button" class="app-header__tool app-header__tool--wide" title="Toggle fullscreen" aria-label="Toggle fullscreen">
            {MAXIMIZE}
          </button>

          <button type="button" class="app-header__bell">
            {BELL}
            <span class="app-header__bell-count" aria-hidden="true">3</span>
          </button>

          <span class="app-header__vr" aria-hidden="true"></span>

          <div class="app-header__dd">
            <button type="button" class="app-header__user" aria-haspopup="menu" aria-expanded="false">
              <span class="app-header__avatar" title="admin@albalqan.com">MA</span>
              <span class="app-header__user-meta">
                <span class="app-header__uname">Maha Al Balqan</span>
                <span class="app-header__urole">Administrator</span>
              </span>
              {CHEVRON}
            </button>
          </div>
        </div>
      </div>
    </header>'''

TOGGLE_SCRIPT = '''
    <script>
      (function () {
        var aside = document.querySelector('aside.sidebar');
        var menu = document.querySelector('.app-header__menu');
        if (!aside || !menu) return;
        menu.addEventListener('click', function () {
          var open = aside.classList.toggle('is-open');
          menu.setAttribute('aria-expanded', String(open));
          menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
        });
      })();
    </script>
'''

for path in sorted(glob.glob('.dev/preview-*.html')):
    with open(path, encoding='utf-8') as fh:
        src = fh.read()
    changed = False
    if '<header class="app-header' in src:
        patched = re.sub(
            r'<header class="app-header no-print">.*?</header>',
            lambda _m: HEADER,
            src,
            flags=re.S,
        )
        if patched != src:
            src = patched
            changed = True
    if os.path.basename(path) == 'preview-shell.html':
        if 'class="sidebar no-print is-open"' not in src and 'class="sidebar no-print"' in src:
            src = src.replace(
                'class="sidebar no-print"', 'class="sidebar no-print is-open"', 1
            )
            changed = True
        if 'aside.classList.toggle' not in src:
            src = src.replace('</body>', TOGGLE_SCRIPT + '  </body>', 1)
            changed = True
    if changed:
        with open(path, 'w', encoding='utf-8') as fh:
            fh.write(src)
        print('patched:', os.path.basename(path))
