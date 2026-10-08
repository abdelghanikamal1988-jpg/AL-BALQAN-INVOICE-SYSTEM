"""Patch preview-dashboard.html: mirror the new Reports markup from Dashboard.jsx.

Rebuilds the whole <section aria-label="Reports"> block as static HTML:
- bars chart with Y axis, 5 grid lines and hover/pin tooltips
- smooth dual-line chart (invoiced vs paid) with Y axis + tooltips
- clients donut, agents-this-month horizontal bars
- agent performance + top customers + access logs tables
Sample data matches the harness's demo numbers.
"""

import re

PATH = '.dev/preview-dashboard.html'

LABELS = ['May 26', 'Jun 26', 'Jul 26', 'Aug 26', 'Sep 26', 'Oct 26']
COUNTS = [4, 6, 3, 7, 5, 8]
INVOICED = [12000, 18500, 9000, 22000, 15400, 25600]
PAID = [9500, 14000, 7500, 16500, 11000, 19500]

ICON_USERS = ('<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
              'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'
              '<circle cx="9" cy="8" r="3.4" /><path d="M3.5 19.5v-1.4a4 4 0 0 1 4-4h3a4 4 0 0 1 4 4v1.4" />'
              '<path d="M17.5 8.5v5M15 11h5" /></svg>')
ICON_CHART = ('<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
              'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'
              '<path d="M3 20.5h18" /><path d="M6 20.5v-6.2" /><path d="M11 20.5V7.5" />'
              '<path d="M16 20.5v-9.4" /><path d="M20.5 20.5V11" /></svg>')
ICON_KEY = ('<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'
            '<circle cx="8" cy="15" r="4.5" /><path d="M11.4 11.9L20.5 2.8M17.5 5.8l2.4 2.4M14.8 8.5l2.4 2.4" /></svg>')


def smooth(pts):
    if len(pts) < 2:
        return ''
    d = f'M{pts[0][0]:.2f},{pts[0][1]:.2f}'
    s = 0.18
    for i in range(len(pts) - 1):
        p0 = pts[i - 1] if i > 0 else pts[i]
        p1, p2 = pts[i], pts[i + 1]
        p3 = pts[i + 2] if i + 2 < len(pts) else p2
        c1x = p1[0] + (p2[0] - p0[0]) * s
        c1y = p1[1] + (p2[1] - p0[1]) * s
        c2x = p2[0] - (p3[0] - p1[0]) * s
        c2y = p2[1] - (p3[1] - p1[1]) * s
        d += (f' C{c1x:.2f},{c1y:.2f} {c2x:.2f},{c2y:.2f} '
              f'{p2[0]:.2f},{p2[1]:.2f}')
    return d


def y_axis(kind):
    # ticks listed top → bottom; k=4 (max) at bottom:100% … k=0 at bottom:0
    if kind == 'count':
        ticks = [8, 6, 4, 2, 0]
    else:
        ticks = [32000, 24000, 16000, 8000, 0]
    out = []
    for i, v in enumerate(ticks):
        bottom = (4 - i) / 4 * 100
        if kind == 'money' and v >= 1000:
            text = f'{v // 1000}k'
        else:
            text = str(v)
        out.append(f'<span style="bottom: {bottom:g}%;">{text}</span>')
    return '\n              '.join(out)


def bars_chart():
    step, max_v = 2, 8
    yaxis = y_axis('count')
    cols = []
    for label, v in zip(LABELS, COUNTS):
        pct = v / max_v * 100
        muted = '' if v > 0 else ' db-bars__bar--muted'
        cols.append(
            f'<div class="db-bars__col" role="button" tabindex="0" aria-label="{label}: {v} invoices">\n'
            f'                  <div class="db-bars__bar{muted}" style="height: {pct:g}%"></div>\n'
            f'                  <div class="db-tip" style="--tipb: {pct:g}%">\n'
            f'                    <b>{label}</b>\n'
            f'                    <span class="db-tip__row"><i class="db-fig__dot"></i>{v} invoices</span>\n'
            f'                  </div>\n'
            f'                </div>'
        )
    labels = '\n              '.join(f'<span>{l}</span>' for l in LABELS)
    grid = '\n            '.join('<span></span>' for _ in range(5))
    cols_html = ''.join(cols)
    return f'''<div class="db-bars">
              <div class="db-bars__yaxis" aria-hidden="true">
              {yaxis}
              </div>
              <div class="db-bars__plot">
                <div class="db-bars__grid" aria-hidden="true">
            {grid}
                </div>
                <div class="db-bars__cols">
                {cols_html}
                </div>
              </div>
              <div class="db-bars__labels">
              {labels}
              </div>
            </div>'''


def line_chart():
    step, max_v = 8000, 32000
    yaxis = y_axis('money')
    xa = [i / 5 * 100 for i in range(6)]
    ya = [96 - (v / max_v) * 88 for v in INVOICED]
    yb = [96 - (v / max_v) * 88 for v in PAID]
    pts_a = list(zip(xa, ya))
    pts_b = list(zip(xa, yb))
    path_a = smooth(pts_a)
    path_b = smooth(pts_b)
    area = f'{path_a} L100,100 L0,100 Z'
    hits = []
    for i, label in enumerate(LABELS):
        y_top = min(ya[i], yb[i])
        tipb = 100 - y_top
        rem = INVOICED[i] - PAID[i]
        hits.append(
            f'<div class="db-lhit" role="button" tabindex="0" aria-label="{label}: invoiced AED {INVOICED[i]:,}, paid AED {PAID[i]:,}">\n'
            f'                <div class="db-tip" style="--tipb: {tipb:g}%">\n'
            f'                  <b>{label}</b>\n'
            f'                  <span class="db-tip__row"><i class="db-fig__dot"></i>Invoiced AED {INVOICED[i]:,.2f}</span>\n'
            f'                  <span class="db-tip__row"><i class="db-fig__dot db-fig__dot--amber"></i>Paid AED {PAID[i]:,.2f}</span>\n'
            f'                  <span class="db-tip__row db-tip__row--muted">Remaining AED {rem:,.2f}</span>\n'
            f'                </div>\n'
            f'              </div>'
        )
    labels = '\n              '.join(f'<span>{l}</span>' for l in LABELS)
    grid = '\n            '.join('<span></span>' for _ in range(5))
    return f'''<div class="db-line">
              <div class="db-line__yaxis" aria-hidden="true">
              {yaxis}
              </div>
              <div class="db-line__plot">
                <div class="db-line__grid" aria-hidden="true">
            {grid}
                </div>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Invoiced versus paid per month, last 6 months">
                  <defs>
                    <linearGradient id="dbLineFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="#22c55e" stop-opacity="0.18" />
                      <stop offset="100%" stop-color="#22c55e" stop-opacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="{area}" fill="url(#dbLineFill)" />
                  <path d="{path_a}" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
                  <path d="{path_b}" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
                </svg>
                <div class="db-lhits">
              {''.join(hits)}
                </div>
              </div>
              <div class="db-line__labels">
              {labels}
              </div>
            </div>'''


def rows(data, cols, classes):
    out = []
    for row in data:
        tds = []
        for value, cls in zip(row, classes):
            cell = value
            if cls:
                cell = f'<td class="{cls}">{value}</td>'
            else:
                cell = f'<td>{value}</td>'
            tds.append(cell)
        out.append('<tr>' + ''.join(tds) + '</tr>')
    return '\n                  '.join(out)


AGENT_ROWS = [
    ('AL NOOR TRAVELS', 9, 5, 5, 7, 'AED 61,200.00', 'AED 44,900.00'),
    ('DESIREE TOURS', 6, 3, 4, 5, 'AED 38,400.00', 'AED 29,150.00'),
    ('CUSTOMER', 5, 2, 2, 3, 'AED 24,300.00', 'AED 18,600.00'),
    ('SAHARA HOLIDAYS', 3, 1, 1, 2, 'AED 15,900.00', 'AED 12,000.00'),
    ('Unassigned', 1, 0, 0, 0, 'AED 0.00', 'AED 0.00'),
]
AGENT_TOTAL = ('Total · 5 agents', 24, 11, 12, 17, 'AED 139,800.00', 'AED 104,650.00')
AGENT_CLASSES = ['', 'db-inv__count', 'db-inv__count', 'db-inv__count', 'db-inv__count',
                 'db-inv__amount', 'db-inv__amount']

CUST_ROWS = [
    ('MARIAM HADDAD', 3, 'AED 27,600.00', 'AED 22,100.00', 'AED 5,500.00'),
    ('RAMI YOUSEF', 2, 'AED 25,500.00', 'AED 20,500.00', 'AED 5,000.00'),
    ('AHMED KHALED', 2, 'AED 16,800.00', 'AED 8,400.00', 'AED 8,400.00'),
    ('SARA MOHAMMED', 2, 'AED 14,400.00', 'AED 9,400.00', 'AED 5,000.00'),
    ('OMAR IBRAHIM', 1, 'AED 12,750.00', 'AED 6,000.00', 'AED 6,750.00'),
    ('LAYAN KHALID', 1, 'AED 8,100.00', 'AED 0.00', 'AED 8,100.00'),
    ('HASSAN TARIQ', 1, 'AED 6,400.00', 'AED 6,400.00', 'AED 0.00'),
    ('YOUSEF NASSER', 1, 'AED 4,500.00', 'AED 4,500.00', 'AED 0.00'),
]
CUST_TOTAL = ('Top 8', 13, 'AED 116,050.00', 'AED 77,300.00', 'AED 38,750.00')
CUST_CLASSES = ['db-inv__customer', 'db-inv__count', 'db-inv__amount', 'db-inv__amount',
                'db-inv__amount']

LOG_ROWS = [
    ('08 Oct 2026, 09:12', 'admin@albalqan.com', 'db-badge db-badge--login', 'LOGIN',
     'Password sign-in'),
    ('08 Oct 2026, 08:03', 'maha@albalqan.com', 'db-badge db-badge--logout', 'LOGOUT',
     'Signed out'),
    ('07 Oct 2026, 22:47', 'maha@albalqan.com', 'db-badge db-badge--idle', 'IDLE LOGOUT',
     'Auto sign-out after 30 minutes of inactivity'),
    ('07 Oct 2026, 17:21', 'unknown@example.com', 'db-badge db-badge--fail', 'FAILED LOGIN',
     'Sign-in failed — wrong email or password'),
    ('07 Oct 2026, 14:05', 'admin@albalqan.com', 'db-badge db-badge--reauth', 'RE-AUTH',
     'Identity confirmed for a sensitive action'),
]

HBARS = [('AL NOOR TRAVELS', 5), ('DESIREE TOURS', 3), ('CUSTOMER', 2),
         ('SAHARA HOLIDAYS', 1), ('ORBIT VOYAGES', 0)]


def hbars():
    max_v = 5
    out = []
    for name, v in HBARS:
        w = (v / max_v) * 100 if v > 0 else 0
        fill_cls = 'db-hbar__fill' if v > 0 else 'db-hbar__fill db-hbar__fill--zero'
        out.append(
            f'<div class="db-hbar">\n'
            f'                    <span class="db-hbar__name" title="{name}">{name}</span>\n'
            f'                    <span class="db-hbar__track"><span class="{fill_cls}" style="width: {w:g}%"></span></span>\n'
            f'                    <span class="db-hbar__val">{v}</span>\n'
            f'                  </div>'
        )
    return '\n                  '.join(out)


REPORTS = f'''<section class="db-section" aria-label="Reports">
              <div class="db-section__head">
                <h2>
                  {ICON_CHART}
                  Reports
                </h2>
                <a href="#" class="db-section__hint">View all →</a>
              </div>

              <div class="db-charts">
                <section class="card db-chart-card" aria-label="Invoices per month">
                  <div class="db-chart-card__head">
                    <h2>Invoices per month</h2>
                    <p class="db-chart-card__sub">Issued invoices over the last 6 months</p>
                  </div>
                  <div class="db-chart-card__body">
                    {bars_chart()}
                  </div>
                  <div class="db-chart-card__foot">
                    <span class="db-fig"><b>33</b> invoices in 6 months</span>
                    <span class="db-fig"><b>8</b> this month</span>
                  </div>
                </section>

                <section class="card db-chart-card" aria-label="Invoiced vs paid">
                  <div class="db-chart-card__head">
                    <h2>Invoiced vs paid</h2>
                    <p class="db-chart-card__sub">Monthly comparison over the last 6 months</p>
                  </div>
                  <div class="db-chart-card__body">
                    {line_chart()}
                  </div>
                  <div class="db-chart-card__foot">
                    <span class="db-fig"><span class="db-fig__dot"></span><b>AED 102,500.00</b> invoiced</span>
                    <span class="db-fig"><span class="db-fig__dot db-fig__dot--amber"></span><b>AED 78,000.00</b> paid</span>
                    <span class="db-fig"><b>AED 24,500.00</b> outstanding</span>
                  </div>
                </section>
              </div>

              <div class="db-charts">
                <section class="card db-chart-card" aria-label="Clients and invoices">
                  <div class="db-chart-card__head">
                    <h2>Clients &amp; invoices</h2>
                    <p class="db-chart-card__sub">Registered clients with or without an invoice</p>
                  </div>
                  <div class="db-chart-card__body">
                    <div class="db-donut-wrap">
                      <div class="db-donut" role="img" aria-label="14 of 24 clients have an invoice" style="background: conic-gradient(#22c55e 0 58.33%, #e5e7eb 58.33% 100%)">
                        <div class="db-donut__center"><b>24</b><span>clients</span></div>
                      </div>
                      <div class="db-donut__legend">
                        <span class="db-fig"><span class="db-fig__dot"></span><b>14</b> with invoice<em>58%</em></span>
                        <span class="db-fig"><span class="db-fig__dot db-fig__dot--muted"></span><b>10</b> without invoice<em>42%</em></span>
                      </div>
                    </div>
                  </div>
                  <div class="db-chart-card__foot">
                    <span class="db-fig"><b>14</b> have invoices</span>
                    <span class="db-fig"><b>10</b> never invoiced</span>
                  </div>
                </section>

                <section class="card db-chart-card" aria-label="Agents this month">
                  <div class="db-chart-card__head">
                    <h2>Agents this month</h2>
                    <p class="db-chart-card__sub">Clients added per referral agent in Oct 2026</p>
                  </div>
                  <div class="db-chart-card__body">
                    <div class="db-hbars">
                  {hbars()}
                    </div>
                  </div>
                  <div class="db-chart-card__foot">
                    <span class="db-fig"><b>11</b> clients this month</span>
                    <span class="db-fig"><b>5</b> active agents</span>
                  </div>
                </section>
              </div>

              <section class="card db-panel" aria-label="Agent performance">
                <div class="db-panel__head">
                  <h2>
                    {ICON_USERS}
                    Agent performance
                  </h2>
                  <span class="db-panel__hint">All-time totals with this month</span>
                </div>
                <div class="db-table-wrap">
                  <table class="db-inv">
                    <thead>
                      <tr>
                        <th>Agent</th>
                        <th class="db-inv__count">Clients</th>
                        <th class="db-inv__count">This month</th>
                        <th class="db-inv__count">With invoice</th>
                        <th class="db-inv__count">Invoices</th>
                        <th class="db-inv__amount">Invoiced</th>
                        <th class="db-inv__amount">Paid</th>
                      </tr>
                    </thead>
                    <tbody>
                  {rows(AGENT_ROWS, 7, AGENT_CLASSES)}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>{AGENT_TOTAL[0]}</td>
                        <td class="db-inv__count">{AGENT_TOTAL[1]}</td>
                        <td class="db-inv__count">{AGENT_TOTAL[2]}</td>
                        <td class="db-inv__count">{AGENT_TOTAL[3]}</td>
                        <td class="db-inv__count">{AGENT_TOTAL[4]}</td>
                        <td class="db-inv__amount">{AGENT_TOTAL[5]}</td>
                        <td class="db-inv__amount">{AGENT_TOTAL[6]}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>

              <section class="card db-panel" aria-label="Top customers">
                <div class="db-panel__head">
                  <h2>
                    {ICON_CHART}
                    Top customers
                  </h2>
                  <span class="db-panel__hint">Ranked by invoiced total</span>
                </div>
                <div class="db-table-wrap">
                  <table class="db-inv">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th class="db-inv__count">Invoices</th>
                        <th class="db-inv__amount">Invoiced</th>
                        <th class="db-inv__amount">Paid</th>
                        <th class="db-inv__amount">Remaining</th>
                      </tr>
                    </thead>
                    <tbody>
                  {rows(CUST_ROWS, 5, CUST_CLASSES)}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>{CUST_TOTAL[0]}</td>
                        <td class="db-inv__count">{CUST_TOTAL[1]}</td>
                        <td class="db-inv__amount">{CUST_TOTAL[2]}</td>
                        <td class="db-inv__amount">{CUST_TOTAL[3]}</td>
                        <td class="db-inv__amount">{CUST_TOTAL[4]}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>

              <section class="card db-panel" aria-label="Recent invoices">
                <div class="db-panel__head">
                  <h2>
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5h12v17l-3-1.6-3 1.6-3-1.6-3 1.6z" /><path d="M9 8h6M9 12h6" /></svg>
                    Recent invoices
                  </h2>
                  <a href="#" class="db-section__hint">View all →</a>
                </div>
                <div class="db-table-wrap">
                  <table class="db-inv">
                    <thead>
                      <tr>
                        <th>Invoice</th>
                        <th>Customer</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th class="db-inv__amount">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td class="db-inv__num">AB-INV-1045</td>
                        <td class="db-inv__customer">Mariam Haddad</td>
                        <td class="db-inv__date">04 Oct 2026</td>
                        <td><span class="db-badge db-badge--paid">Paid</span></td>
                        <td class="db-inv__amount">AED 9,200.00</td>
                      </tr>
                      <tr>
                        <td class="db-inv__num">AB-INV-1044</td>
                        <td class="db-inv__customer">Ahmed Khaled Saleh</td>
                        <td class="db-inv__date">03 Oct 2026</td>
                        <td><span class="db-badge db-badge--partial">Partial</span></td>
                        <td class="db-inv__amount">AED 14,750.00</td>
                      </tr>
                      <tr>
                        <td class="db-inv__num">AB-INV-1043</td>
                        <td class="db-inv__customer">Rami Yousef</td>
                        <td class="db-inv__date">02 Oct 2026</td>
                        <td><span class="db-badge db-badge--unpaid">Unpaid</span></td>
                        <td class="db-inv__amount">AED 6,400.00</td>
                      </tr>
                      <tr>
                        <td class="db-inv__num">AB-INV-1042</td>
                        <td class="db-inv__customer">Sara Mahmoud</td>
                        <td class="db-inv__date">01 Oct 2026</td>
                        <td><span class="db-badge db-badge--paid">Paid</span></td>
                        <td class="db-inv__amount">AED 4,500.00</td>
                      </tr>
                      <tr>
                        <td class="db-inv__num">AB-INV-1041</td>
                        <td class="db-inv__customer">Omar Farouk</td>
                        <td class="db-inv__date">30 Sep 2026</td>
                        <td><span class="db-badge db-badge--partial">Partial</span></td>
                        <td class="db-inv__amount">AED 12,750.00</td>
                      </tr>
                      <tr>
                        <td class="db-inv__num">AB-INV-1040</td>
                        <td class="db-inv__customer">Yousef Nasser</td>
                        <td class="db-inv__date">28 Sep 2026</td>
                        <td><span class="db-badge db-badge--unpaid">Unpaid</span></td>
                        <td class="db-inv__amount">AED 8,100.00</td>
                      </tr>
                      <tr>
                        <td class="db-inv__num">AB-INV-1039</td>
                        <td class="db-inv__customer">Layla Ibrahim</td>
                        <td class="db-inv__date">26 Sep 2026</td>
                        <td><span class="db-badge db-badge--paid">Paid</span></td>
                        <td class="db-inv__amount">AED 21,300.00</td>
                      </tr>
                      <tr>
                        <td class="db-inv__num">AB-INV-1038</td>
                        <td class="db-inv__customer">Hassan Tariq</td>
                        <td class="db-inv__date">24 Sep 2026</td>
                        <td><span class="db-badge db-badge--unpaid">Unpaid</span></td>
                        <td class="db-inv__amount">AED 3,750.00</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section class="card db-panel" aria-label="Access logs">
                <div class="db-panel__head">
                  <h2>
                    {ICON_KEY}
                    Access logs
                  </h2>
                  <span class="db-panel__hint">Sign-ins for all accounts on this device</span>
                </div>
                <div class="db-table-wrap">
                  <table class="db-inv">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Account</th>
                        <th>Action</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {''.join(
                          f'<tr><td class="db-inv__date">{t}</td><td class="db-inv__num">{acct}</td>'
                          f'<td><span class="{cls}">{action}</span></td>'
                          f'<td class="db-inv__customer">{detail}</td></tr>'
                          for t, acct, cls, action, detail in LOG_ROWS
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </section>'''

with open(PATH, encoding='utf-8') as fh:
    src = fh.read()

pattern = re.compile(
    r'<section class="db-section" aria-label="Reports">.*?</section>\s*\n\s*\n\s*<div class="db-grid">',
    re.S,
)
new_src, count = pattern.subn(REPORTS + '\n\n            <div class="db-grid">', src, count=1)
if count != 1:
    raise SystemExit('Reports section anchor not found — patch aborted')

with open(PATH, 'w', encoding='utf-8', newline='\n') as fh:
    fh.write(new_src)
print('patched Reports section in', PATH)
