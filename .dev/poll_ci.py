import json
import sys
import time
import urllib.request

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SHA = sys.argv[1] if len(sys.argv) > 1 else ''
URL = ('https://api.github.com/repos/abdelghanikamal1988-jpg/'
       'AL-BALQAN-INVOICE-SYSTEM/actions/runs?per_page=6')

for attempt in range(40):
    try:
        req = urllib.request.Request(URL, headers={'User-Agent': 'ci-poll'})
        data = json.load(urllib.request.urlopen(req, timeout=20))
    except Exception as e:  # noqa: BLE001
        print('api error', e)
        time.sleep(15)
        continue
    runs = data.get('workflow_runs', [])
    pick = None
    if SHA:
        for r in runs:
            if r.get('head_sha', '').startswith(SHA[:7]) or r.get('head_sha') == SHA:
                pick = r
                break
    if pick is None and runs:
        pick = runs[0]
    if pick:
        print(attempt, pick.get('head_sha', '')[:7], pick.get('name'),
              'status=', pick.get('status'), 'conclusion=', pick.get('conclusion'),
              pick.get('html_url'))
        if pick.get('status') == 'completed':
            sys.exit(0 if pick.get('conclusion') == 'success' else 2)
    time.sleep(20)
print('timeout')
sys.exit(3)
