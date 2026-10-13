"""Verify the live GitHub Pages deployment serves the word-only-enlarged
lockup (wordmark scaled to the icon's height) plus the phone icon variant."""
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
      'has scaled lockup (905.33):', '905.33' in bundle,
      '| has phone icon variant (107.44 134):', '107.44 134' in bundle,
      '| old unscaled lockup gone:', '465.1 146.9' not in bundle)

logo = urllib.request.urlopen(BASE + 'logo.svg', timeout=30).read().decode('utf-8', 'replace')
viewbox = re.search(r'viewBox="[^"]+"', logo)
print('logo.svg:', len(logo), 'chars,', viewbox.group(0) if viewbox else 'NO viewBox',
      ', paths:', logo.count('<path'), ', groups:', logo.count('<g'),
      ', word scaled:', 'scale(' in logo, ', currentColor:', 'fill="currentColor"' in logo)
