"""Verify the live GitHub Pages deployment serves the new bundle and logo."""
import re
import urllib.request

BASE = 'https://abdelghanikamal1988-jpg.github.io/AL-BALQAN-INVOICE-SYSTEM/'

html = urllib.request.urlopen(BASE, timeout=30).read().decode('utf-8', 'replace')
print('js:', re.findall(r'assets/index-[\w-]+\.js', html))
print('css:', re.findall(r'assets/index-[\w-]+\.css', html))

logo = urllib.request.urlopen(BASE + 'logo.svg', timeout=30).read().decode('utf-8', 'replace')
viewbox = re.search(r'viewBox="[^"]+"', logo)
print('logo.svg:', len(logo), 'chars,', viewbox.group(0) if viewbox else 'NO viewBox',
      ', paths:', logo.count('<path'), ', has wordmark text:', 'AL BALQAN' in logo)
