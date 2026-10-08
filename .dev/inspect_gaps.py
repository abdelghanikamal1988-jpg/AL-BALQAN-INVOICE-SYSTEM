import io
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')


def inspect(path, cls):
    s = io.open(path, encoding='utf-8').read()
    for mm in re.finditer(r'<table class="%s"' % cls, s):
        b = s[mm.start():s.find('</table>', mm.start())]
        ths = re.findall(r'<th[^>]*>(.*?)</th>', b, re.S)
        keys = [re.sub(r'<[^>]+>', '', t).replace('\xa0', ' ').strip() for t in ths]
        rows = re.findall(r'<tr[^>]*>.*?</tr>', b, re.S)
        tds = len(re.findall(r'<td[^>]*>', b))
        all_tr = b.count('<tr')
        print('== %s .%s keys=%d rows(matched)=%d <tr=%d tds=%d tfoot=%s tbody=%d' % (
            path, cls, len(keys), len(rows), all_tr, tds, 'tfoot' in b, b.count('<tbody>')))
        print('   keys:', keys)
        for r in rows:
            bad = [t for t in re.findall(r'<td[^>]*>', r) if 'data-label=' not in t]
            if bad:
                print('   unlabelled in row: %d  %s' % (len(bad), bad[:8]))
        # rows outside matched (e.g. missing </tr>)
        matched_tds = sum(len(re.findall(r'<td[^>]*>', r)) for r in rows)
        if tds != matched_tds:
            print('   NOTE: tds outside matched rows: %d' % (tds - matched_tds))
        print()


inspect('.dev/preview-admin.html', 'au-table')
inspect('.dev/preview-dashboard.html', 'db-inv')
