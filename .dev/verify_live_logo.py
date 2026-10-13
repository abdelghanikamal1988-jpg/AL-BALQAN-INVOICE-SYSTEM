"""Verify the live GitHub Pages deployment serves the icon-only logo
(no wordmark, icon slightly enlarged)."""
import re
import urllib.request

BASE = 'https://abdelghanikamal1988-jpg.github.io/AL-BALQAN-INVOICE-SYSTEM/'

html = urllib.request.urlopen(BASE, timeout=30).read().decode('utf-8', 'replace')
js = re.findall(r'assets/index-[\w-]+\.js', html)
css = re.findall(r'assets/index-[\w-]+\.css', html)
print('js:', js)
print('css:', css)

bundle = urllib.request.urlopen(BASE + js[0], timeout=60).read().decode('utf-8', 'replace')
print('bundle', js[0], len(bundle), 'chars,',
      'has icon viewBox:', '107.44 134' in bundle,
      '| full lockup gone:', '465.1 146.9' not in bundle,
      '| scaled lockup gone:', '905.33' not in bundle)

logo = urllib.request.urlopen(BASE + 'logo.svg', timeout=30).read().decode('utf-8', 'replace')
viewbox = re.search(r'viewBox="[^"]+"', logo)
print('logo.svg:', len(logo), 'chars,', viewbox.group(0) if viewbox else 'NO viewBox',
      ', paths:', logo.count('<path'), ', groups:', logo.count('<g'),
      ', no wordmark transform:', 'scale(' not in logo)
