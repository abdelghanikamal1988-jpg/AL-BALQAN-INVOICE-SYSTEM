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
import { useLang } from '../../context/LangContext.jsx';

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

const STATUS_I18N = {
  NEW: 'status.NEW',
  'DOCUMENTS SUBMITTED': 'status.DOCUMENTS',
  SUBMITTED: 'status.SUBMITTED',
  'UNDER REVIEW': 'status.UNDER_REVIEW',
  APPROVED: 'status.APPROVED',
  REJECTED: 'status.REJECTED',
};

function statusLabel(raw, t) {
  return t(STATUS_I18N[raw] || raw);
}

function greetingFor(user, t) {
  const label = (user?.email || '').split('@')[0].replace(/[._-]+/g, ' ').trim();
  const hour = new Date().getHours();
  const part = hour < 12 ? t('dashboard.greeting.morning') : hour < 18 ? t('dashboard.greeting.afternoon') : t('dashboard.greeting.evening');
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
  const { t } = useLang();
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
                aria-label={`${labels[i]}: ${v === 1 ? t('dashboard.tip.invoice', { v }) : t('dashboard.tip.invoices', { v })}`}
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
                    {v === 1 ? t('dashboard.tip.invoice', { v }) : t('dashboard.tip.invoices', { v })}
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
  const { t } = useLang();
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
          aria-label={t('dashboard.a11y.lineChart')}
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
                aria-label={t('dashboard.a11y.lineHit', { label: l, invoiced: formatCurrency(invoiced[i]), paid: formatCurrency(paid[i]) })}
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
                    {t('dashboard.tip.invoiced', { v: formatCurrency(invoiced[i]) })}
                  </span>
                  <span className="db-tip__row">
                    <i className="db-fig__dot db-fig__dot--amber" aria-hidden="true" />
                    {t('dashboard.tip.paid', { v: formatCurrency(paid[i]) })}
                  </span>
                  <span className="db-tip__row db-tip__row--muted">
                    {t('dashboard.tip.remaining', { v: formatCurrency(remaining) })}
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
  if (status === 'PAID') return { cls: 'db-badge db-badge--paid', text: 'dashboard.badge.paid' };
  if (status === 'PARTIALLY_PAID') return { cls: 'db-badge db-badge--partial', text: 'dashboard.badge.partial' };
  return { cls: 'db-badge db-badge--unpaid', text: 'dashboard.badge.unpaid' };
}

const LOG_BADGE = {
  LOGIN: { cls: 'db-badge db-badge--login', text: 'dashboard.log.login' },
  'FAILED LOGIN': { cls: 'db-badge db-badge--fail', text: 'dashboard.log.failedLogin' },
  LOGOUT: { cls: 'db-badge db-badge--logout', text: 'dashboard.log.logout' },
  'IDLE LOGOUT': { cls: 'db-badge db-badge--idle', text: 'dashboard.log.idleLogout' },
  'RE-AUTH': { cls: 'db-badge db-badge--reauth', text: 'dashboard.log.reauth' },
  'FAILED RE-AUTH': { cls: 'db-badge db-badge--fail', text: 'dashboard.log.failedReauth' },
  'ACCOUNT DISABLED': { cls: 'db-badge db-badge--fail', text: 'dashboard.log.accountDisabled' },
};

const ACT_TYPE_I18N = {
  APPLICATION: 'dashboard.type.application',
  STATUS: 'dashboard.type.status',
  INVOICE: 'dashboard.type.invoice',
  PAYMENT: 'dashboard.type.payment',
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
  const { t } = useLang();
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
      const name = clientFullName(c) || t('dashboard.activity.clientFallback');
      push(c.createdAt, 'APPLICATION', t('dashboard.activity.applicationCreated', { name }), statusLabel(c.status || 'NEW', t));
      if (c.updatedAt && c.createdAt && c.updatedAt !== c.createdAt) {
        push(c.updatedAt, 'STATUS', t('dashboard.activity.recordUpdated', { name }), statusLabel(c.status || 'NEW', t));
      }
    });

    invoices.forEach((inv) => {
      const breakdown = invoicePaymentBreakdown(inv.payment);
      const calc = calculatePayment(breakdown.grandTotal, breakdown.paid);
      const label = inv.invoiceNumber || t('dashboard.activity.invoiceFallback');
      const who = inv.customer?.name ? t('dashboard.activity.invoiceCustomer', { label, name: inv.customer.name }) : label;
      push(inv.issueDate, 'INVOICE', who, formatCurrency(calc.total));
      if (Number(calc.paid) > 0) {
        push(inv.issueDate, 'PAYMENT', t('dashboard.activity.paymentRecorded', { label }), formatCurrency(calc.paid));
      }
    });

    rows.sort((a, b) => b.ts - a.ts);
    return rows.slice(0, 7);
  }, [clients, invoices, t]);

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
      const name = String(c.referralAgent || '').trim() || t('dashboard.agent.unassigned');
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
  }, [clients, invoices, t]);

  /* Customers ranked by invoiced total. */
  const topCustomers = useMemo(() => {
    const map = new Map();
    invoices.forEach((inv) => {
      const name = inv.customer?.name || t('dashboard.customer.unknown');
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
  }, [invoices, t]);

  /* Sign-in / sign-out events for every account on this device. */
  const accessLogs = useMemo(() => getAccessLogs(), [refreshKey]);

  const handleExport = async () => {
    let list;
    try {
      list = await getInvoices();
    } catch (err) {
      toast.error(t('dashboard.export.loadError'));
      return;
    }
    if (list.length === 0) {
      toast.info(t('dashboard.export.empty'));
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
    toast.success(t('dashboard.export.success'));
  };

  const handleImportFile = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      importInvoices(JSON.parse(reader.result))
        .then((added) => {
          if (added === 0) {
            toast.info(t('dashboard.import.none'));
          } else {
            toast.success(added > 1 ? t('dashboard.import.many', { v: added }) : t('dashboard.import.one', { v: added }));
            setRefreshKey((k) => k + 1);
          }
        })
        .catch(() => {
          toast.error(t('dashboard.import.invalid'));
        });
    };
    reader.onerror = () => {
      toast.error(t('dashboard.import.readError'));
    };
    reader.readAsText(file);
  };

  const dash = (value) => (loading ? '—' : value);

  const clientMetrics = [
    ['dashboard.metric.totalClients', dash(clientStats.total), 'users', 'slate'],
    ['dashboard.metric.newClients', dash(clientStats.fresh), 'user', 'green'],
    ['dashboard.metric.underReview', dash(clientStats.review), 'clock', 'amber'],
    ['dashboard.metric.approved', dash(clientStats.approved), 'userCheck', 'green'],
    ['dashboard.metric.rejected', dash(clientStats.rejected), 'x', 'red'],
  ];

  const moneyMetrics = [
    ['dashboard.metric.totalInvoiced', dash(formatCurrency(financials.invoiced)), 'receipt', 'slate', true],
    ['dashboard.metric.totalPaid', dash(formatCurrency(financials.paid)), 'card', 'green', true],
    ['dashboard.metric.totalRemaining', dash(formatCurrency(financials.remaining)), 'note', 'amber', true],
    ['dashboard.metric.partiallyPaid', dash(financials.partiallyPaid === 1 ? t('dashboard.tip.invoice', { v: financials.partiallyPaid }) : t('dashboard.tip.invoices', { v: financials.partiallyPaid })), 'clock', 'purple', false],
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
          <p className="db-hero__eyebrow">{t('dashboard.eyebrow')}</p>
          <h1>{greetingFor(user, t)}</h1>
          <p className="db-hero__sub">
            {t('dashboard.hero.sub', { company: company.shortName })}
          </p>
        </div>
        <div className="db-hero__actions">
          <Can perm="page:clients.new">
            <Link to="/clients/new" className="btn btn--primary">
              {t('dashboard.action.newClient')}
            </Link>
          </Can>
          <Can perm="page:invoice.create">
            <Link to="/create" className="btn btn--secondary">
              {t('dashboard.action.newInvoice')}
            </Link>
          </Can>
        </div>
      </section>

      {isAdmin && pendingCount > 0 && (
        <div className="db-approval" role="status">
          <span className="db-approval__icon" aria-hidden="true"><Icon name="clock" /></span>
          <span className="db-approval__text">
            <b>
              {pendingCount > 1
                ? t('dashboard.approval.edits', { v: pendingCount })
                : t('dashboard.approval.edit', { v: pendingCount })}
            </b>
            <span>
              {t('dashboard.approval.note')}
            </span>
          </span>
          <button type="button" className="btn btn--primary" onClick={openApprovals}>
            {t('dashboard.approval.review')}
          </button>
        </div>
      )}

      <section className="db-section" aria-label={t('dashboard.section.clientOverview')}>
        <div className="db-section__head">
          <h2>
            <Icon name="users" aria-hidden="true" />
            {t('dashboard.section.clientOverview')}
          </h2>
          <Can perm="page:clients">
            <Link to="/clients" className="db-section__hint">
              {t('dashboard.link.viewClients')}
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
                <span className="statc__label">{t(label)}</span>
                <span className="statc__value">{value}</span>
              </span>
              <span className="statc__chev" aria-hidden="true">
                <Icon name="chevronRight" />
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="db-section" aria-label={t('dashboard.section.financialOverview')}>
        <div className="db-section__head">
          <h2>
            <Icon name="receipt" aria-hidden="true" />
            {t('dashboard.section.financialOverview')}
          </h2>
          <Can perm="page:invoice.history">
            <Link to="/history" className="db-section__hint">
              {t('dashboard.link.invoiceHistory')}
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
                <span className="statc__label">{t(label)}</span>
                <span className={`statc__value${money ? ' db-metric__value--money' : ''}`}>{value}</span>
              </span>
              <span className="statc__chev" aria-hidden="true">
                <Icon name="chevronRight" />
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="db-section" aria-label={t('dashboard.section.reports')}>
        <div className="db-section__head">
          <h2>
            <Icon name="chartBar" aria-hidden="true" />
            {t('dashboard.section.reports')}
          </h2>
          <Can perm="page:invoice.history">
            <Link to="/history" className="db-section__hint">
              {t('dashboard.link.viewAll')}
            </Link>
          </Can>
        </div>

        <div className="db-charts">
          <section className="card db-chart-card" aria-label={t('dashboard.chart.invoicesPerMonth')}>
            <div className="db-chart-card__head">
              <h2>{t('dashboard.chart.invoicesPerMonth')}</h2>
              <p className="db-chart-card__sub">{t('dashboard.chart.invoicesPerMonthSub')}</p>
            </div>
            <div className="db-chart-card__body">
              {loading ? (
                <div className="loading-row">
                  <span className="spinner" aria-hidden="true" />
                  {t('dashboard.loading.chart')}
                </div>
              ) : (
                <BarsChart labels={seriesLabels} values={seriesCounts} />
              )}
            </div>
            <div className="db-chart-card__foot">
              <span className="db-fig">
                <b>{loading ? '—' : seriesTotals.count}</b> {t('dashboard.foot.invoices6')}
              </span>
              <span className="db-fig">
                <b>{loading ? '—' : lastMonth.count}</b> {t('dashboard.foot.thisMonth')}
              </span>
            </div>
          </section>

          <section className="card db-chart-card" aria-label={t('dashboard.chart.invoicedVsPaid')}>
            <div className="db-chart-card__head">
              <h2>{t('dashboard.chart.invoicedVsPaid')}</h2>
              <p className="db-chart-card__sub">{t('dashboard.chart.invoicedVsPaidSub')}</p>
            </div>
            <div className="db-chart-card__body">
              {loading ? (
                <div className="loading-row">
                  <span className="spinner" aria-hidden="true" />
                  {t('dashboard.loading.chart')}
                </div>
              ) : (
                <LineChart labels={seriesLabels} invoiced={seriesRevenue} paid={seriesPaid} />
              )}
            </div>
            <div className="db-chart-card__foot">
              <span className="db-fig">
                <span className="db-fig__dot" aria-hidden="true" />
                <b>{loading ? '—' : formatCurrency(seriesTotals.revenue)}</b> {t('dashboard.foot.invoiced')}
              </span>
              <span className="db-fig">
                <span className="db-fig__dot db-fig__dot--amber" aria-hidden="true" />
                <b>{loading ? '—' : formatCurrency(seriesTotals.paid)}</b> {t('dashboard.foot.paid')}
              </span>
              <span className="db-fig">
                <b>{loading ? '—' : formatCurrency(round2(seriesTotals.revenue - seriesTotals.paid))}</b>{' '}
                {t('dashboard.foot.outstanding')}
              </span>
            </div>
          </section>
        </div>

        <div className="db-charts">
          <section className="card db-chart-card" aria-label={t('dashboard.a11y.clientsInvoices')}>
            <div className="db-chart-card__head">
              <h2>{t('dashboard.chart.clientsInvoices')}</h2>
              <p className="db-chart-card__sub">{t('dashboard.chart.clientsInvoicesSub')}</p>
            </div>
            <div className="db-chart-card__body">
              <div className="db-donut-wrap">
                <div
                  className="db-donut"
                  role="img"
                  aria-label={t('dashboard.a11y.donut', { with: coverage.withInvoice, total: coverage.total })}
                  style={{
                    background: `conic-gradient(#22c55e 0 ${donutPct}%, #e5e7eb ${donutPct}% 100%)`,
                  }}
                >
                  <div className="db-donut__center">
                    <b>{loading ? '—' : coverage.total}</b>
                    <span>{t('dashboard.foot.clients')}</span>
                  </div>
                </div>
                <div className="db-donut__legend">
                  <span className="db-fig">
                    <span className="db-fig__dot" aria-hidden="true" />
                    <b>{loading ? '—' : coverage.withInvoice}</b> {t('dashboard.foot.withInvoice')}
                    <em>{donutPctInt}%</em>
                  </span>
                  <span className="db-fig">
                    <span className="db-fig__dot db-fig__dot--muted" aria-hidden="true" />
                    <b>{loading ? '—' : coverage.without}</b> {t('dashboard.foot.withoutInvoice')}
                    <em>{100 - donutPctInt}%</em>
                  </span>
                </div>
              </div>
            </div>
            <div className="db-chart-card__foot">
              <span className="db-fig">
                <b>{loading ? '—' : coverage.withInvoice}</b> {t('dashboard.foot.haveInvoices')}
              </span>
              <span className="db-fig">
                <b>{loading ? '—' : coverage.without}</b> {t('dashboard.foot.neverInvoiced')}
              </span>
            </div>
          </section>

          <section className="card db-chart-card" aria-label={t('dashboard.chart.agentsThisMonth')}>
            <div className="db-chart-card__head">
              <h2>{t('dashboard.chart.agentsThisMonth')}</h2>
              <p className="db-chart-card__sub">{t('dashboard.chart.agentsThisMonthSub', { month: lastMonth.label.split(' ')[0], year: new Date().getFullYear() })}</p>
            </div>
            <div className="db-chart-card__body">
              {loading ? (
                <div className="loading-row">
                  <span className="spinner" aria-hidden="true" />
                  {t('dashboard.loading.agents')}
                </div>
              ) : agentStats.length === 0 ? (
                <p className="db-empty">{t('dashboard.empty.agentsChart')}</p>
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
                <b>{loading ? '—' : agentTotals.thisMonth}</b> {t('dashboard.foot.clientsThisMonth')}
              </span>
              <span className="db-fig">
                <b>{loading ? '—' : agentStats.length}</b> {t('dashboard.foot.activeAgents')}
              </span>
            </div>
          </section>
        </div>

        <section className="card db-panel" aria-label={t('dashboard.panel.agentPerformance')}>
          <div className="db-panel__head">
            <h2>
              <Icon name="users" aria-hidden="true" />
              {t('dashboard.panel.agentPerformance')}
            </h2>
            <span className="db-panel__hint">{t('dashboard.panel.agentPerformanceHint')}</span>
          </div>
          {loading ? (
            <div className="loading-row">
              <span className="spinner" aria-hidden="true" />
              {t('dashboard.loading.agents')}
            </div>
          ) : agentStats.length === 0 ? (
            <p className="db-empty">{t('dashboard.empty.agentTable')}</p>
          ) : (
            <div className="db-table-wrap">
              <table className="db-inv">
                <thead>
                  <tr>
                    <th>{t('dashboard.th.agent')}</th>
                    <th className="db-inv__count">{t('dashboard.th.clients')}</th>
                    <th className="db-inv__count">{t('dashboard.th.thisMonth')}</th>
                    <th className="db-inv__count">{t('dashboard.th.withInvoice')}</th>
                    <th className="db-inv__count">{t('dashboard.th.invoices')}</th>
                    <th className="db-inv__amount">{t('dashboard.th.invoiced')}</th>
                    <th className="db-inv__amount">{t('dashboard.th.paid')}</th>
                  </tr>
                </thead>
                <tbody>
                  {agentStats.map((r) => (
                    <tr key={r.agent}>
                      <td className="db-inv__num" data-label={t('dashboard.th.agent')}>{r.agent}</td>
                      <td className="db-inv__count" data-label={t('dashboard.th.clients')}>{r.clients}</td>
                      <td className="db-inv__count" data-label={t('dashboard.th.thisMonth')}>{r.thisMonth}</td>
                      <td className="db-inv__count" data-label={t('dashboard.th.withInvoice')}>{r.withInvoice}</td>
                      <td className="db-inv__count" data-label={t('dashboard.th.invoices')}>{r.invoices}</td>
                      <td className="db-inv__amount" data-label={t('dashboard.th.invoiced')}>{formatCurrency(r.invoiced)}</td>
                      <td className="db-inv__amount" data-label={t('dashboard.th.paid')}>{formatCurrency(r.paid)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td data-label={t('dashboard.th.agent')}>{t('dashboard.tfoot.totalAgents', { v: agentStats.length })}</td>
                    <td className="db-inv__count" data-label={t('dashboard.th.clients')}>{agentTotals.clients}</td>
                    <td className="db-inv__count" data-label={t('dashboard.th.thisMonth')}>{agentTotals.thisMonth}</td>
                    <td className="db-inv__count" data-label={t('dashboard.th.withInvoice')}>{agentTotals.withInvoice}</td>
                    <td className="db-inv__count" data-label={t('dashboard.th.invoices')}>{agentTotals.invoices}</td>
                    <td className="db-inv__amount" data-label={t('dashboard.th.invoiced')}>{formatCurrency(agentTotals.invoiced)}</td>
                    <td className="db-inv__amount" data-label={t('dashboard.th.paid')}>{formatCurrency(agentTotals.paid)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        <section className="card db-panel" aria-label={t('dashboard.panel.topCustomers')}>
          <div className="db-panel__head">
            <h2>
              <Icon name="chartBar" aria-hidden="true" />
              {t('dashboard.panel.topCustomers')}
            </h2>
            <span className="db-panel__hint">{t('dashboard.panel.topCustomersHint')}</span>
          </div>
          {loading ? (
            <div className="loading-row">
              <span className="spinner" aria-hidden="true" />
              {t('dashboard.loading.customers')}
            </div>
          ) : topCustomers.length === 0 ? (
            <p className="db-empty">{t('dashboard.empty.customers')}</p>
          ) : (
            <div className="db-table-wrap">
              <table className="db-inv">
                <thead>
                  <tr>
                    <th>{t('dashboard.th.customer')}</th>
                    <th className="db-inv__count">{t('dashboard.th.invoices')}</th>
                    <th className="db-inv__amount">{t('dashboard.th.invoiced')}</th>
                    <th className="db-inv__amount">{t('dashboard.th.paid')}</th>
                    <th className="db-inv__amount">{t('dashboard.th.remaining')}</th>
                  </tr>
                </thead>
                <tbody>
                  {topCustomers.map((r) => (
                    <tr key={r.name}>
                      <td className="db-inv__customer" data-label={t('dashboard.th.customer')}>{r.name}</td>
                      <td className="db-inv__count" data-label={t('dashboard.th.invoices')}>{r.invoices}</td>
                      <td className="db-inv__amount" data-label={t('dashboard.th.invoiced')}>{formatCurrency(r.invoiced)}</td>
                      <td className="db-inv__amount" data-label={t('dashboard.th.paid')}>{formatCurrency(r.paid)}</td>
                      <td className="db-inv__amount" data-label={t('dashboard.th.remaining')}>{formatCurrency(r.remaining)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td data-label={t('dashboard.th.customer')}>{t('dashboard.tfoot.top', { v: topCustomers.length })}</td>
                    <td className="db-inv__count" data-label={t('dashboard.th.invoices')}>{customerTotals.invoices}</td>
                    <td className="db-inv__amount" data-label={t('dashboard.th.invoiced')}>{formatCurrency(customerTotals.invoiced)}</td>
                    <td className="db-inv__amount" data-label={t('dashboard.th.paid')}>{formatCurrency(customerTotals.paid)}</td>
                    <td className="db-inv__amount" data-label={t('dashboard.th.remaining')}>{formatCurrency(customerTotals.remaining)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        <section className="card db-panel" aria-label={t('dashboard.panel.recentInvoices')}>
          <div className="db-panel__head">
            <h2>
              <Icon name="receipt" aria-hidden="true" />
              {t('dashboard.panel.recentInvoices')}
            </h2>
            <Can perm="page:invoice.history">
              <Link to="/history" className="db-section__hint">
                {t('dashboard.link.viewAll')}
              </Link>
            </Can>
          </div>
          {loading ? (
            <div className="loading-row">
              <span className="spinner" aria-hidden="true" />
              {t('dashboard.loading.invoices')}
            </div>
          ) : recentInvoices.length === 0 ? (
            <p className="db-empty">{t('dashboard.empty.invoices')}</p>
          ) : (
            <div className="db-table-wrap">
              <table className="db-inv">
                <thead>
                  <tr>
                    <th>{t('dashboard.th.invoice')}</th>
                    <th>{t('dashboard.th.customer')}</th>
                    <th>{t('dashboard.th.date')}</th>
                    <th>{t('common.status')}</th>
                    <th className="db-inv__amount">{t('dashboard.th.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map(({ inv, calc }, i) => {
                    const badge = invoiceBadge(calc.status);
                    return (
                      <tr key={inv.id || `${inv.invoiceNumber || 'inv'}-${i}`}>
                        <td className="db-inv__num" data-label={t('dashboard.th.invoice')}>{inv.invoiceNumber || '—'}</td>
                        <td className="db-inv__customer" data-label={t('dashboard.th.customer')}>{inv.customer?.name || '—'}</td>
                        <td className="db-inv__date" data-label={t('dashboard.th.date')}>
                          {inv.issueDate
                            ? formatDateShort(new Date(inv.issueDate)) || inv.issueDate
                            : '—'}
                        </td>
                        <td data-label={t('common.status')}>
                          <span className={badge.cls}>{t(badge.text)}</span>
                        </td>
                        <td className="db-inv__amount" data-label={t('dashboard.th.amount')}>{formatCurrency(calc.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {isAdmin && (
          <section className="card db-panel" aria-label={t('dashboard.panel.accessLogs')}>
            <div className="db-panel__head">
              <h2>
                <Icon name="key" aria-hidden="true" />
                {t('dashboard.panel.accessLogs')}
              </h2>
              <span className="db-panel__hint">{t('dashboard.panel.accessLogsHint')}</span>
            </div>
            {accessLogs.length === 0 ? (
              <p className="db-empty">
                {t('dashboard.empty.accessLogs')}
              </p>
            ) : (
              <div className="db-table-wrap">
                <table className="db-inv">
                  <thead>
                    <tr>
                      <th>{t('dashboard.th.time')}</th>
                      <th>{t('dashboard.th.account')}</th>
                      <th>{t('dashboard.th.action')}</th>
                      <th>{t('dashboard.th.details')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accessLogs.slice(0, 10).map((row) => {
                      const badge = logBadge(row.action);
                      return (
                        <tr key={row.id}>
                          <td className="db-inv__date" data-label={t('dashboard.th.time')}>{logTime(row.ts)}</td>
                          <td className="db-inv__num" data-label={t('dashboard.th.account')}>{row.account}</td>
                          <td data-label={t('dashboard.th.action')}>
                            <span className={badge.cls}>{t(badge.text)}</span>
                          </td>
                          <td className="db-inv__customer" data-label={t('dashboard.th.details')}>{row.details || '—'}</td>
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
        <section className="card db-panel" aria-label={t('dashboard.panel.recentActivity')}>
          <div className="db-panel__head">
            <h2>
              <Icon name="activity" aria-hidden="true" />
              {t('dashboard.panel.recentActivity')}
            </h2>
            <span className="db-panel__hint">{t('dashboard.panel.recentActivityHint')}</span>
          </div>
          {loading ? (
            <div className="loading-row">
              <span className="spinner" aria-hidden="true" />
              {t('dashboard.loading.activity')}
            </div>
          ) : activity.length === 0 ? (
            <p className="db-empty">{t('dashboard.empty.activity')}</p>
          ) : (
            <div className="db-act-wrap">
              <table className="db-act">
                <thead>
                  <tr>
                    <th>{t('dashboard.th.date')}</th>
                    <th>{t('dashboard.th.type')}</th>
                    <th>{t('dashboard.th.activity')}</th>
                    <th>{t('dashboard.th.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((row, i) => (
                    <tr key={`${row.ts}-${row.type}-${i}`}>
                      <td className="db-act__date">
                        {formatDateShort(new Date(row.date)) || row.date}
                      </td>
                      <td>
                        <span className="db-act__type">{t(ACT_TYPE_I18N[row.type] || row.type)}</span>
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

        <section className="card db-panel" aria-label={t('dashboard.panel.applicationStatus')}>
          <div className="db-panel__head">
            <h2>
              <Icon name="userCheck" aria-hidden="true" />
              {t('dashboard.panel.applicationStatus')}
            </h2>
            <span className="db-panel__hint">{loading ? '…' : t('dashboard.panel.applicationStatusHint', { v: clientStats.total })}</span>
          </div>
          <div className="db-status">
            {CLIENT_STATUSES.map((s) => {
              const count = clientStats.counts[s] || 0;
              const pct = Math.round((count / maxStatusCount) * 100);
              return (
                <div className="db-status__row" key={s}>
                  <span className="db-status__name">{statusLabel(s, t)}</span>
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
            {t('dashboard.utility.note')}
          </span>
          <Can perm="action:invoice.export">
            <button type="button" className="btn btn--neutral btn--sm" onClick={handleExport}>
              {t('dashboard.utility.export')}
            </button>
          </Can>
          <Can perm="action:invoice.import">
            <button
              type="button"
              className="btn btn--neutral btn--sm"
              onClick={() => fileInputRef.current?.click()}
            >
              {t('dashboard.utility.import')}
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
        <Link to="/create" className="fab" title={t('dashboard.fab.newInvoice')} aria-label={t('dashboard.fab.newInvoice')}>
          <Icon name="pencil" />
        </Link>
      )}
    </div>
  );
}
