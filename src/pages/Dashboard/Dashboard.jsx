import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icons/Icon.jsx';
import company from '../../data/company.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { getInvoices, importInvoices } from '../../utils/storage.js';
import { calculatePayment, PAYMENT_STATUS } from '../../utils/paymentCalculator.js';
import { invoicePaymentBreakdown } from '../../utils/vat.js';
import { formatDateShort } from '../../utils/formatDate.js';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { dbFetchClients } from '../../lib/clientRepo.js';
import { clientFullName, normalizePassport } from '../../utils/clients.js';
import { getAccessLogs } from '../../utils/accessLog.js';
import { CLIENT_STATUSES } from '../../data/clientStatuses.js';
import { useToast } from '../../components/Toast/ToastProvider.jsx';
import { usePendingApprovals } from '../../context/PendingApprovalsContext.jsx';
import Can from '../../components/Can/Can.jsx';

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

function greetingFor(user) {
  const label = (user?.email || '').split('@')[0].replace(/[._-]+/g, ' ').trim();
  const hour = new Date().getHours();
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return label ? `${part}, ${label}` : part;
}

/* ---------- Nexus-style charts (no chart library) ---------- */

const TICKS = [4, 3, 2, 1, 0]; // grid lines / axis labels, top → bottom

/** Round the (value / 4) step up to a readable 1-2-5-ish tick step. */
function axisStep(raw, kind) {
  const quarter = Math.max(raw, 1) / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(quarter)));
  const norm = quarter / mag;
  const ladder = kind === 'money' ? [1, 1.5, 2, 3, 4, 5, 6, 8, 10] : [1, 2, 3, 4, 5, 6, 8, 10];
  const s = ladder.find((x) => x >= norm - 1e-9) || 10;
  const step = s * mag;
  return kind === 'count' ? Math.max(1, Math.round(step)) : step;
}

function fmtTick(v, kind) {
  if (kind === 'money') {
    if (v >= 1000) {
      const k = v / 1000;
      return `${Number.isInteger(k) ? k : Math.round(k * 10) / 10}k`;
    }
    return String(Math.round(v));
  }
  return String(v);
}

/** Catmull-Rom → cubic bezier: a smooth, flowing line through every point. */
function smoothPath(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const s = 0.18;
    const c1x = p1[0] + (p2[0] - p0[0]) * s;
    const c1y = p1[1] + (p2[1] - p0[1]) * s;
    const c2x = p2[0] - (p3[0] - p1[0]) * s;
    const c2y = p2[1] - (p3[1] - p1[1]) * s;
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d;
}

function BarsChart({ labels, values }) {
  const [pin, setPin] = useState(null);
  const step = axisStep(Math.max(0, ...values), 'count');
  const max = step * 4 || 1;
  return (
    <div className="db-bars">
      <div className="db-bars__yaxis" aria-hidden="true">
        {TICKS.map((k) => (
          <span key={k} style={{ bottom: `${(k / 4) * 100}%` }}>
            {fmtTick(step * k, 'count')}
          </span>
        ))}
      </div>
      <div className="db-bars__plot">
        <div className="db-bars__grid" aria-hidden="true">
          {TICKS.map((k) => (
            <span key={k} />
          ))}
        </div>
        <div className="db-bars__cols">
          {values.map((v, i) => {
            const pct = v > 0 ? Math.max((v / max) * 100, 3) : 1.4;
            const toggle = () => setPin((p) => (p === i ? null : i));
            return (
              <div
                className={`db-bars__col${pin === i ? ' is-active' : ''}`}
                key={`${labels[i]}-${i}`}
                role="button"
                tabIndex={0}
                aria-label={`${labels[i]}: ${v} invoices`}
                onClick={toggle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle();
                  }
                }}
              >
                <div
                  className={`db-bars__bar${v > 0 ? '' : ' db-bars__bar--muted'}`}
                  style={{ height: `${pct}%` }}
                />
                <div className="db-tip" style={{ '--tipb': `${pct}%` }}>
                  <b>{labels[i]}</b>
                  <span className="db-tip__row">
                    <i className="db-fig__dot" aria-hidden="true" />
                    {v} invoice{v === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="db-bars__labels">
        {labels.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  );
}

function LineChart({ labels, invoiced, paid }) {
  const [pin, setPin] = useState(null);
  const step = axisStep(Math.max(0, ...invoiced, ...paid), 'money');
  const max = step * 4 || 1;
  const n = labels.length;
  const xOf = (i) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const yOf = (v) => 96 - (Math.min(v, max) / max) * 88;
  const ptsA = invoiced.map((v, i) => [xOf(i), yOf(v)]);
  const ptsB = paid.map((v, i) => [xOf(i), yOf(v)]);
  const pathA = smoothPath(ptsA);
  const pathB = smoothPath(ptsB);
  const areaA = `${pathA} L100,100 L0,100 Z`;
  return (
    <div className="db-line">
      <div className="db-line__yaxis" aria-hidden="true">
        {TICKS.map((k) => (
          <span key={k} style={{ bottom: `${(k / 4) * 100}%` }}>
            {fmtTick(step * k, 'money')}
          </span>
        ))}
      </div>
      <div className="db-line__plot">
        <div className="db-line__grid" aria-hidden="true">
          {TICKS.map((k) => (
            <span key={k} />
          ))}
        </div>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label="Invoiced versus paid per month, last 6 months"
        >
          <defs>
            <linearGradient id="dbLineFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaA} fill="url(#dbLineFill)" />
          <path
            d={pathA}
            fill="none"
            stroke="#22c55e"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={pathB}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="db-lhits">
          {labels.map((l, i) => {
            const yTop = Math.min(ptsA[i][1], ptsB[i][1]);
            const remaining = round2(invoiced[i] - paid[i]);
            const toggle = () => setPin((p) => (p === i ? null : i));
            return (
              <div
                className={`db-lhit${pin === i ? ' is-active' : ''}`}
                key={l}
                role="button"
                tabIndex={0}
                aria-label={`${l}: invoiced ${formatCurrency(invoiced[i])}, paid ${formatCurrency(paid[i])}`}
                onClick={toggle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle();
                  }
                }}
              >
                <div className="db-tip" style={{ '--tipb': `${100 - yTop}%` }}>
                  <b>{l}</b>
                  <span className="db-tip__row">
                    <i className="db-fig__dot" aria-hidden="true" />
                    Invoiced {formatCurrency(invoiced[i])}
                  </span>
                  <span className="db-tip__row">
                    <i className="db-fig__dot db-fig__dot--amber" aria-hidden="true" />
                    Paid {formatCurrency(paid[i])}
                  </span>
                  <span className="db-tip__row db-tip__row--muted">
                    Remaining {formatCurrency(remaining)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="db-line__labels">
        {labels.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  );
}

function invoiceBadge(status) {
  if (status === 'PAID') return { cls: 'db-badge db-badge--paid', text: 'Paid' };
  if (status === 'PARTIALLY_PAID') return { cls: 'db-badge db-badge--partial', text: 'Partial' };
  return { cls: 'db-badge db-badge--unpaid', text: 'Unpaid' };
}

const LOG_BADGE = {
  LOGIN: { cls: 'db-badge db-badge--login', text: 'LOGIN' },
  'FAILED LOGIN': { cls: 'db-badge db-badge--fail', text: 'FAILED LOGIN' },
  LOGOUT: { cls: 'db-badge db-badge--logout', text: 'LOGOUT' },
  'IDLE LOGOUT': { cls: 'db-badge db-badge--idle', text: 'IDLE LOGOUT' },
  'RE-AUTH': { cls: 'db-badge db-badge--reauth', text: 'RE-AUTH' },
  'FAILED RE-AUTH': { cls: 'db-badge db-badge--fail', text: 'FAILED RE-AUTH' },
  'ACCOUNT DISABLED': { cls: 'db-badge db-badge--fail', text: 'ACCOUNT DISABLED' },
};

function logBadge(action) {
  return LOG_BADGE[action] || { cls: 'db-badge db-badge--logout', text: String(action || '—').toUpperCase() };
}

function logTime(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${formatDateShort(d) || ''}, ${time}`.replace(/^,\s*/, '');
}

export default function Dashboard() {
  const toast = useToast();
  const { user, hasPerm, isAdmin } = useAuth();
  const { count: pendingCount, openApprovals } = usePendingApprovals();
  const [refreshKey, setRefreshKey] = useState(0);
  const fileInputRef = useRef(null);
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      getInvoices().catch(() => []),
      dbFetchClients().catch((err) => {
        console.warn('Client list unavailable on the dashboard', err);
        return [];
      }),
    ])
      .then(([invList, clientList]) => {
        if (!active) return;
        setInvoices(invList);
        setClients(clientList);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const clientStats = useMemo(() => {
    const counts = {};
    CLIENT_STATUSES.forEach((s) => {
      counts[s] = 0;
    });
    clients.forEach((c) => {
      const s = CLIENT_STATUSES.includes(c.status) ? c.status : 'NEW';
      counts[s] = (counts[s] || 0) + 1;
    });
    return {
      total: clients.length,
      fresh: counts.NEW || 0,
      review: counts['UNDER REVIEW'] || 0,
      approved: counts.APPROVED || 0,
      rejected: counts.REJECTED || 0,
      counts,
    };
  }, [clients]);

  const financials = useMemo(() => {
    let invoiced = 0;
    let paid = 0;
    let remaining = 0;
    let partiallyPaid = 0;
    invoices.forEach((inv) => {
      const breakdown = invoicePaymentBreakdown(inv.payment);
      const calc = calculatePayment(breakdown.grandTotal, breakdown.paid);
      invoiced += Number(calc.total) || 0;
      paid += Number(calc.paid) || 0;
      remaining += Number(calc.remaining) || 0;
      if (calc.status === PAYMENT_STATUS.PARTIALLY_PAID) partiallyPaid += 1;
    });
    return {
      invoiced: round2(invoiced),
      paid: round2(paid),
      remaining: round2(remaining),
      partiallyPaid,
    };
  }, [invoices]);

  const activity = useMemo(() => {
    const rows = [];
    const push = (timestamp, type, label, detail) => {
      const time = timestamp ? Date.parse(timestamp) : NaN;
      if (Number.isNaN(time)) return;
      rows.push({
        ts: time,
        date: String(timestamp).slice(0, 10),
        type,
        label,
        detail,
      });
    };

    clients.forEach((c) => {
      const name = clientFullName(c) || 'Client';
      push(c.createdAt, 'APPLICATION', `${name} — application created`, c.status || 'NEW');
      if (c.updatedAt && c.createdAt && c.updatedAt !== c.createdAt) {
        push(c.updatedAt, 'STATUS', `${name} — record updated`, c.status || 'NEW');
      }
    });

    invoices.forEach((inv) => {
      const breakdown = invoicePaymentBreakdown(inv.payment);
      const calc = calculatePayment(breakdown.grandTotal, breakdown.paid);
      const label = inv.invoiceNumber || 'Invoice';
      const who = inv.customer?.name ? `${label} — ${inv.customer.name}` : label;
      push(inv.issueDate, 'INVOICE', who, formatCurrency(calc.total));
      if (Number(calc.paid) > 0) {
        push(inv.issueDate, 'PAYMENT', `${label} — payment recorded`, formatCurrency(calc.paid));
      }
    });

    rows.sort((a, b) => b.ts - a.ts);
    return rows.slice(0, 7);
  }, [clients, invoices]);

  const monthSeries = useMemo(() => {
    const now = new Date();
    const buckets = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${d.toLocaleString('en-US', { month: 'short' })} ${String(d.getFullYear()).slice(2)}`;
      buckets.push({ key, label, count: 0, revenue: 0, paid: 0 });
    }
    const idx = {};
    buckets.forEach((b, i) => {
      idx[b.key] = i;
    });
    invoices.forEach((inv) => {
      const dt = inv.issueDate ? String(inv.issueDate).slice(0, 10) : '';
      if (!/^\d{4}-\d{2}/.test(dt)) return;
      const k = dt.slice(0, 7);
      if (!(k in idx)) return;
      const breakdown = invoicePaymentBreakdown(inv.payment);
      const calc = calculatePayment(breakdown.grandTotal, breakdown.paid);
      buckets[idx[k]].count += 1;
      buckets[idx[k]].revenue += Number(calc.total) || 0;
      buckets[idx[k]].paid += Number(calc.paid) || 0;
    });
    return buckets.map((b) => ({ ...b, revenue: round2(b.revenue), paid: round2(b.paid) }));
  }, [invoices]);

  const recentInvoices = useMemo(() => {
    return invoices
      .map((inv) => {
        const breakdown = invoicePaymentBreakdown(inv.payment);
        const calc = calculatePayment(breakdown.grandTotal, breakdown.paid);
        return { inv, calc };
      })
      .sort((a, b) =>
        String(b.inv.issueDate || '').localeCompare(String(a.inv.issueDate || '')),
      )
      .slice(0, 8);
  }, [invoices]);

  /* Registered clients that have at least one invoice vs. none. */
  const coverage = useMemo(() => {
    const passports = new Set(invoices.map((inv) => normalizePassport(inv.customer?.passport)));
    let withInvoice = 0;
    clients.forEach((c) => {
      if (passports.has(normalizePassport(c.passport))) withInvoice += 1;
    });
    return { total: clients.length, withInvoice, without: clients.length - withInvoice };
  }, [clients, invoices]);

  /* Per referral-agent breakdown: clients, this month, linked invoices, money. */
  const agentStats = useMemo(() => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const byPassport = new Map();
    invoices.forEach((inv) => {
      const key = normalizePassport(inv.customer?.passport);
      const breakdown = invoicePaymentBreakdown(inv.payment);
      const calc = calculatePayment(breakdown.grandTotal, breakdown.paid);
      const list = byPassport.get(key) || [];
      list.push(calc);
      byPassport.set(key, list);
    });

    const map = new Map();
    clients.forEach((c) => {
      const name = String(c.referralAgent || '').trim() || 'Unassigned';
      const row = map.get(name) || {
        agent: name,
        clients: 0,
        thisMonth: 0,
        withInvoice: 0,
        invoices: 0,
        invoiced: 0,
        paid: 0,
      };
      row.clients += 1;
      if (String(c.createdAt || '').slice(0, 7) === monthKey) row.thisMonth += 1;
      const list = byPassport.get(normalizePassport(c.passport)) || [];
      if (list.length > 0) row.withInvoice += 1;
      row.invoices += list.length;
      list.forEach((calc) => {
        row.invoiced += Number(calc.total) || 0;
        row.paid += Number(calc.paid) || 0;
      });
      map.set(name, row);
    });

    return [...map.values()]
      .map((r) => ({ ...r, invoiced: round2(r.invoiced), paid: round2(r.paid) }))
      .sort((a, b) => b.thisMonth - a.thisMonth || b.clients - a.clients || a.agent.localeCompare(b.agent));
  }, [clients, invoices]);

  /* Customers ranked by invoiced total. */
  const topCustomers = useMemo(() => {
    const map = new Map();
    invoices.forEach((inv) => {
      const name = inv.customer?.name || 'Unknown customer';
      const key = `${name}|${normalizePassport(inv.customer?.passport)}`;
      const breakdown = invoicePaymentBreakdown(inv.payment);
      const calc = calculatePayment(breakdown.grandTotal, breakdown.paid);
      const row = map.get(key) || { name, invoices: 0, invoiced: 0, paid: 0, remaining: 0 };
      row.invoices += 1;
      row.invoiced += Number(calc.total) || 0;
      row.paid += Number(calc.paid) || 0;
      row.remaining += Number(calc.remaining) || 0;
      map.set(key, row);
    });
    return [...map.values()]
      .map((r) => ({
        ...r,
        invoiced: round2(r.invoiced),
        paid: round2(r.paid),
        remaining: round2(r.remaining),
      }))
      .sort((a, b) => b.invoiced - a.invoiced)
      .slice(0, 8);
  }, [invoices]);

  /* Sign-in / sign-out events for every account on this device. */
  const accessLogs = useMemo(() => getAccessLogs(), [refreshKey]);

  const handleExport = async () => {
    let list;
    try {
      list = await getInvoices();
    } catch (err) {
      toast.error('Unable to load invoices for export.');
      return;
    }
    if (list.length === 0) {
      toast.info('No invoices to export yet.');
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(list, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `albalqan-invoices-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success('Backup exported successfully.');
  };

  const handleImportFile = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      importInvoices(JSON.parse(reader.result))
        .then((added) => {
          if (added === 0) {
            toast.info('No new invoices were added (duplicates skipped).');
          } else {
            toast.success(`${added} invoice${added > 1 ? 's' : ''} imported.`);
            setRefreshKey((k) => k + 1);
          }
        })
        .catch(() => {
          toast.error('Import failed. The file is not a valid AL BALQAN backup.');
        });
    };
    reader.onerror = () => {
      toast.error('Import failed. Could not read the file.');
    };
    reader.readAsText(file);
  };

  const dash = (value) => (loading ? '—' : value);

  const clientMetrics = [
    ['Total clients', dash(clientStats.total), 'users', 'slate'],
    ['New clients', dash(clientStats.fresh), 'user', 'green'],
    ['Under review', dash(clientStats.review), 'clock', 'amber'],
    ['Approved', dash(clientStats.approved), 'userCheck', 'green'],
    ['Rejected', dash(clientStats.rejected), 'x', 'red'],
  ];

  const moneyMetrics = [
    ['Total invoiced', dash(formatCurrency(financials.invoiced)), 'receipt', 'slate', true],
    ['Total paid', dash(formatCurrency(financials.paid)), 'card', 'green', true],
    ['Total remaining', dash(formatCurrency(financials.remaining)), 'note', 'amber', true],
    ['Partially paid', dash(`${financials.partiallyPaid} invoice${financials.partiallyPaid === 1 ? '' : 's'}`), 'clock', 'purple', false],
  ];

  const maxStatusCount = Math.max(1, ...CLIENT_STATUSES.map((s) => clientStats.counts[s] || 0));

  const seriesLabels = monthSeries.map((b) => b.label);
  const seriesCounts = monthSeries.map((b) => b.count);
  const seriesRevenue = monthSeries.map((b) => b.revenue);
  const seriesTotals = monthSeries.reduce(
    (acc, b) => ({
      count: acc.count + b.count,
      revenue: round2(acc.revenue + b.revenue),
      paid: round2(acc.paid + b.paid),
    }),
    { count: 0, revenue: 0, paid: 0 },
  );
  const lastMonth = monthSeries[monthSeries.length - 1];
  const seriesPaid = monthSeries.map((b) => b.paid);

  const donutPct = coverage.total > 0 ? (coverage.withInvoice / coverage.total) * 100 : 0;
  const donutPctInt = Math.round(donutPct);

  const agentTotals = agentStats.reduce(
    (acc, r) => ({
      clients: acc.clients + r.clients,
      thisMonth: acc.thisMonth + r.thisMonth,
      withInvoice: acc.withInvoice + r.withInvoice,
      invoices: acc.invoices + r.invoices,
      invoiced: round2(acc.invoiced + r.invoiced),
      paid: round2(acc.paid + r.paid),
    }),
    { clients: 0, thisMonth: 0, withInvoice: 0, invoices: 0, invoiced: 0, paid: 0 },
  );

  const customerTotals = topCustomers.reduce(
    (acc, r) => ({
      invoices: acc.invoices + r.invoices,
      invoiced: round2(acc.invoiced + r.invoiced),
      paid: round2(acc.paid + r.paid),
      remaining: round2(acc.remaining + r.remaining),
    }),
    { invoices: 0, invoiced: 0, paid: 0, remaining: 0 },
  );

  return (
    <div className="page">
      <section className="db-hero">
        <div className="db-hero__text">
          <p className="db-hero__eyebrow">Dashboard</p>
          <h1>{greetingFor(user)}</h1>
          <p className="db-hero__sub">
            Client applications and invoicing for {company.shortName} — every number below is read
            live from your records.
          </p>
        </div>
        <div className="db-hero__actions">
          <Can perm="page:clients.new">
            <Link to="/clients/new" className="btn btn--primary">
              + New Client
            </Link>
          </Can>
          <Can perm="page:invoice.create">
            <Link to="/create" className="btn btn--secondary">
              + New Invoice
            </Link>
          </Can>
        </div>
      </section>

      {isAdmin && pendingCount > 0 && (
        <div className="db-approval" role="status">
          <span className="db-approval__icon" aria-hidden="true"><Icon name="clock" /></span>
          <span className="db-approval__text">
            <b>
              {pendingCount} edit{pendingCount > 1 ? 's' : ''} waiting for your approval
            </b>
            <span>
              Invoice and client changes submitted by your team won’t apply until you review them.
            </span>
          </span>
          <button type="button" className="btn btn--primary" onClick={openApprovals}>
            Review
          </button>
        </div>
      )}

      <section className="db-section" aria-label="Client overview">
        <div className="db-section__head">
          <h2>
            <Icon name="users" aria-hidden="true" />
            Client overview
          </h2>
          <Can perm="page:clients">
            <Link to="/clients" className="db-section__hint">
              View clients →
            </Link>
          </Can>
        </div>
        <div className="db-metrics">
          {clientMetrics.map(([label, value, icon, tile]) => (
            <div className="statc" key={label}>
              <span className={`statc__tile statc__tile--${tile}`} aria-hidden="true">
                <Icon name={icon} />
              </span>
              <span className="statc__text">
                <span className="statc__label">{label}</span>
                <span className="statc__value">{value}</span>
              </span>
              <span className="statc__chev" aria-hidden="true">
                <Icon name="chevronRight" />
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="db-section" aria-label="Financial overview">
        <div className="db-section__head">
          <h2>
            <Icon name="receipt" aria-hidden="true" />
            Financial overview
          </h2>
          <Can perm="page:invoice.history">
            <Link to="/history" className="db-section__hint">
              Invoice history →
            </Link>
          </Can>
        </div>
        <div className="db-metrics db-metrics--money">
          {moneyMetrics.map(([label, value, icon, tile, money]) => (
            <div className="statc" key={label}>
              <span className={`statc__tile statc__tile--${tile}`} aria-hidden="true">
                <Icon name={icon} />
              </span>
              <span className="statc__text">
                <span className="statc__label">{label}</span>
                <span className={`statc__value${money ? ' db-metric__value--money' : ''}`}>{value}</span>
              </span>
              <span className="statc__chev" aria-hidden="true">
                <Icon name="chevronRight" />
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="db-section" aria-label="Reports">
        <div className="db-section__head">
          <h2>
            <Icon name="chartBar" aria-hidden="true" />
            Reports
          </h2>
          <Can perm="page:invoice.history">
            <Link to="/history" className="db-section__hint">
              View all →
            </Link>
          </Can>
        </div>

        <div className="db-charts">
          <section className="card db-chart-card" aria-label="Invoices per month">
            <div className="db-chart-card__head">
              <h2>Invoices per month</h2>
              <p className="db-chart-card__sub">Issued invoices over the last 6 months</p>
            </div>
            <div className="db-chart-card__body">
              {loading ? (
                <div className="loading-row">
                  <span className="spinner" aria-hidden="true" />
                  Loading chart…
                </div>
              ) : (
                <BarsChart labels={seriesLabels} values={seriesCounts} />
              )}
            </div>
            <div className="db-chart-card__foot">
              <span className="db-fig">
                <b>{loading ? '—' : seriesTotals.count}</b> invoices in 6 months
              </span>
              <span className="db-fig">
                <b>{loading ? '—' : lastMonth.count}</b> this month
              </span>
            </div>
          </section>

          <section className="card db-chart-card" aria-label="Invoiced vs paid">
            <div className="db-chart-card__head">
              <h2>Invoiced vs paid</h2>
              <p className="db-chart-card__sub">Monthly comparison over the last 6 months</p>
            </div>
            <div className="db-chart-card__body">
              {loading ? (
                <div className="loading-row">
                  <span className="spinner" aria-hidden="true" />
                  Loading chart…
                </div>
              ) : (
                <LineChart labels={seriesLabels} invoiced={seriesRevenue} paid={seriesPaid} />
              )}
            </div>
            <div className="db-chart-card__foot">
              <span className="db-fig">
                <span className="db-fig__dot" aria-hidden="true" />
                <b>{loading ? '—' : formatCurrency(seriesTotals.revenue)}</b> invoiced
              </span>
              <span className="db-fig">
                <span className="db-fig__dot db-fig__dot--amber" aria-hidden="true" />
                <b>{loading ? '—' : formatCurrency(seriesTotals.paid)}</b> paid
              </span>
              <span className="db-fig">
                <b>{loading ? '—' : formatCurrency(round2(seriesTotals.revenue - seriesTotals.paid))}</b>{' '}
                outstanding
              </span>
            </div>
          </section>
        </div>

        <div className="db-charts">
          <section className="card db-chart-card" aria-label="Clients and invoices">
            <div className="db-chart-card__head">
              <h2>Clients &amp; invoices</h2>
              <p className="db-chart-card__sub">Registered clients with or without an invoice</p>
            </div>
            <div className="db-chart-card__body">
              <div className="db-donut-wrap">
                <div
                  className="db-donut"
                  role="img"
                  aria-label={`${coverage.withInvoice} of ${coverage.total} clients have an invoice`}
                  style={{
                    background: `conic-gradient(#22c55e 0 ${donutPct}%, #e5e7eb ${donutPct}% 100%)`,
                  }}
                >
                  <div className="db-donut__center">
                    <b>{loading ? '—' : coverage.total}</b>
                    <span>clients</span>
                  </div>
                </div>
                <div className="db-donut__legend">
                  <span className="db-fig">
                    <span className="db-fig__dot" aria-hidden="true" />
                    <b>{loading ? '—' : coverage.withInvoice}</b> with invoice
                    <em>{donutPctInt}%</em>
                  </span>
                  <span className="db-fig">
                    <span className="db-fig__dot db-fig__dot--muted" aria-hidden="true" />
                    <b>{loading ? '—' : coverage.without}</b> without invoice
                    <em>{100 - donutPctInt}%</em>
                  </span>
                </div>
              </div>
            </div>
            <div className="db-chart-card__foot">
              <span className="db-fig">
                <b>{loading ? '—' : coverage.withInvoice}</b> have invoices
              </span>
              <span className="db-fig">
                <b>{loading ? '—' : coverage.without}</b> never invoiced
              </span>
            </div>
          </section>

          <section className="card db-chart-card" aria-label="Agents this month">
            <div className="db-chart-card__head">
              <h2>Agents this month</h2>
              <p className="db-chart-card__sub">Clients added per referral agent in {lastMonth.label.split(' ')[0]} {new Date().getFullYear()}</p>
            </div>
            <div className="db-chart-card__body">
              {loading ? (
                <div className="loading-row">
                  <span className="spinner" aria-hidden="true" />
                  Loading agents…
                </div>
              ) : agentStats.length === 0 ? (
                <p className="db-empty">No clients yet. Add a client to see agent performance.</p>
              ) : (
                <div className="db-hbars">
                  {agentStats.slice(0, 7).map((r) => {
                    const maxMonth = Math.max(1, ...agentStats.map((x) => x.thisMonth));
                    const width = r.thisMonth > 0 ? Math.max((r.thisMonth / maxMonth) * 100, 4) : 0;
                    return (
                      <div className="db-hbar" key={r.agent}>
                        <span className="db-hbar__name" title={r.agent}>
                          {r.agent}
                        </span>
                        <span className="db-hbar__track">
                          <span
                            className={`db-hbar__fill${r.thisMonth > 0 ? '' : ' db-hbar__fill--zero'}`}
                            style={{ width: `${width}%` }}
                          />
                        </span>
                        <span className="db-hbar__val">{r.thisMonth}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="db-chart-card__foot">
              <span className="db-fig">
                <b>{loading ? '—' : agentTotals.thisMonth}</b> clients this month
              </span>
              <span className="db-fig">
                <b>{loading ? '—' : agentStats.length}</b> active agents
              </span>
            </div>
          </section>
        </div>

        <section className="card db-panel" aria-label="Agent performance">
          <div className="db-panel__head">
            <h2>
              <Icon name="users" aria-hidden="true" />
              Agent performance
            </h2>
            <span className="db-panel__hint">All-time totals with this month</span>
          </div>
          {loading ? (
            <div className="loading-row">
              <span className="spinner" aria-hidden="true" />
              Loading agents…
            </div>
          ) : agentStats.length === 0 ? (
            <p className="db-empty">No clients yet. Agent totals appear as soon as you add clients.</p>
          ) : (
            <div className="db-table-wrap">
              <table className="db-inv">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th className="db-inv__count">Clients</th>
                    <th className="db-inv__count">This month</th>
                    <th className="db-inv__count">With invoice</th>
                    <th className="db-inv__count">Invoices</th>
                    <th className="db-inv__amount">Invoiced</th>
                    <th className="db-inv__amount">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {agentStats.map((r) => (
                    <tr key={r.agent}>
                      <td className="db-inv__num">{r.agent}</td>
                      <td className="db-inv__count">{r.clients}</td>
                      <td className="db-inv__count">{r.thisMonth}</td>
                      <td className="db-inv__count">{r.withInvoice}</td>
                      <td className="db-inv__count">{r.invoices}</td>
                      <td className="db-inv__amount">{formatCurrency(r.invoiced)}</td>
                      <td className="db-inv__amount">{formatCurrency(r.paid)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total · {agentStats.length} agents</td>
                    <td className="db-inv__count">{agentTotals.clients}</td>
                    <td className="db-inv__count">{agentTotals.thisMonth}</td>
                    <td className="db-inv__count">{agentTotals.withInvoice}</td>
                    <td className="db-inv__count">{agentTotals.invoices}</td>
                    <td className="db-inv__amount">{formatCurrency(agentTotals.invoiced)}</td>
                    <td className="db-inv__amount">{formatCurrency(agentTotals.paid)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        <section className="card db-panel" aria-label="Top customers">
          <div className="db-panel__head">
            <h2>
              <Icon name="chartBar" aria-hidden="true" />
              Top customers
            </h2>
            <span className="db-panel__hint">Ranked by invoiced total</span>
          </div>
          {loading ? (
            <div className="loading-row">
              <span className="spinner" aria-hidden="true" />
              Loading customers…
            </div>
          ) : topCustomers.length === 0 ? (
            <p className="db-empty">No invoices yet. Customer totals appear once you issue invoices.</p>
          ) : (
            <div className="db-table-wrap">
              <table className="db-inv">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th className="db-inv__count">Invoices</th>
                    <th className="db-inv__amount">Invoiced</th>
                    <th className="db-inv__amount">Paid</th>
                    <th className="db-inv__amount">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {topCustomers.map((r) => (
                    <tr key={r.name}>
                      <td className="db-inv__customer">{r.name}</td>
                      <td className="db-inv__count">{r.invoices}</td>
                      <td className="db-inv__amount">{formatCurrency(r.invoiced)}</td>
                      <td className="db-inv__amount">{formatCurrency(r.paid)}</td>
                      <td className="db-inv__amount">{formatCurrency(r.remaining)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Top {topCustomers.length}</td>
                    <td className="db-inv__count">{customerTotals.invoices}</td>
                    <td className="db-inv__amount">{formatCurrency(customerTotals.invoiced)}</td>
                    <td className="db-inv__amount">{formatCurrency(customerTotals.paid)}</td>
                    <td className="db-inv__amount">{formatCurrency(customerTotals.remaining)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        <section className="card db-panel" aria-label="Recent invoices">
          <div className="db-panel__head">
            <h2>
              <Icon name="receipt" aria-hidden="true" />
              Recent invoices
            </h2>
            <Can perm="page:invoice.history">
              <Link to="/history" className="db-section__hint">
                View all →
              </Link>
            </Can>
          </div>
          {loading ? (
            <div className="loading-row">
              <span className="spinner" aria-hidden="true" />
              Loading invoices…
            </div>
          ) : recentInvoices.length === 0 ? (
            <p className="db-empty">No invoices yet. Create your first invoice to see it here.</p>
          ) : (
            <div className="db-table-wrap">
              <table className="db-inv">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th className="db-inv__amount">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map(({ inv, calc }, i) => {
                    const badge = invoiceBadge(calc.status);
                    return (
                      <tr key={inv.id || `${inv.invoiceNumber || 'inv'}-${i}`}>
                        <td className="db-inv__num">{inv.invoiceNumber || '—'}</td>
                        <td className="db-inv__customer">{inv.customer?.name || '—'}</td>
                        <td className="db-inv__date">
                          {inv.issueDate
                            ? formatDateShort(new Date(inv.issueDate)) || inv.issueDate
                            : '—'}
                        </td>
                        <td>
                          <span className={badge.cls}>{badge.text}</span>
                        </td>
                        <td className="db-inv__amount">{formatCurrency(calc.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {isAdmin && (
          <section className="card db-panel" aria-label="Access logs">
            <div className="db-panel__head">
              <h2>
                <Icon name="key" aria-hidden="true" />
                Access logs
              </h2>
              <span className="db-panel__hint">Sign-ins for all accounts on this device</span>
            </div>
            {accessLogs.length === 0 ? (
              <p className="db-empty">
                No access events yet. Sign-ins, sign-outs and failed attempts appear here
                automatically.
              </p>
            ) : (
              <div className="db-table-wrap">
                <table className="db-inv">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Account</th>
                      <th>Action</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accessLogs.slice(0, 10).map((row) => {
                      const badge = logBadge(row.action);
                      return (
                        <tr key={row.id}>
                          <td className="db-inv__date">{logTime(row.ts)}</td>
                          <td className="db-inv__num">{row.account}</td>
                          <td>
                            <span className={badge.cls}>{badge.text}</span>
                          </td>
                          <td className="db-inv__customer">{row.details || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </section>

      <div className="db-grid">
        <section className="card db-panel" aria-label="Recent activity">
          <div className="db-panel__head">
            <h2>
              <Icon name="activity" aria-hidden="true" />
              Recent activity
            </h2>
            <span className="db-panel__hint">Applications, invoices and payments</span>
          </div>
          {loading ? (
            <div className="loading-row">
              <span className="spinner" aria-hidden="true" />
              Loading activity…
            </div>
          ) : activity.length === 0 ? (
            <p className="db-empty">No activity yet. Create a client or an invoice to begin.</p>
          ) : (
            <div className="db-act-wrap">
              <table className="db-act">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Activity</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((row, i) => (
                    <tr key={`${row.ts}-${row.type}-${i}`}>
                      <td className="db-act__date">
                        {formatDateShort(new Date(row.date)) || row.date}
                      </td>
                      <td>
                        <span className="db-act__type">{row.type}</span>
                      </td>
                      <td className="db-act__label">{row.label}</td>
                      <td className="db-act__detail">{row.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card db-panel" aria-label="Application status">
          <div className="db-panel__head">
            <h2>
              <Icon name="userCheck" aria-hidden="true" />
              Application status
            </h2>
            <span className="db-panel__hint">{loading ? '…' : `${clientStats.total} total`}</span>
          </div>
          <div className="db-status">
            {CLIENT_STATUSES.map((s) => {
              const count = clientStats.counts[s] || 0;
              const pct = Math.round((count / maxStatusCount) * 100);
              return (
                <div className="db-status__row" key={s}>
                  <span className="db-status__name">{s}</span>
                  <span className="db-status__bar">
                    <span
                      className="db-status__fill"
                      style={{ width: loading ? '0%' : `${count > 0 ? Math.max(pct, 4) : 0}%` }}
                    />
                  </span>
                  <span className="db-status__count">{loading ? '—' : count}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {(hasPerm('action:invoice.export') || hasPerm('action:invoice.import')) && (
        <div className="db-utility">
          <span className="db-utility__note">
            Invoices are stored in the cloud — use Export Data for a JSON backup.
          </span>
          <Can perm="action:invoice.export">
            <button type="button" className="btn btn--neutral btn--sm" onClick={handleExport}>
              Export Data
            </button>
          </Can>
          <Can perm="action:invoice.import">
            <button
              type="button"
              className="btn btn--neutral btn--sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Import Data
            </button>
          </Can>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
              e.target.value = '';
            }}
          />
        </div>
      )}

      {hasPerm('page:invoice.create') && (
        <Link to="/create" className="fab" title="New invoice" aria-label="New invoice">
          <Icon name="pencil" />
        </Link>
      )}
    </div>
  );
}
