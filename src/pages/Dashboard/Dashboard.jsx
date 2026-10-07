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
import { clientFullName } from '../../utils/clients.js';
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
          <h2>Client overview</h2>
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
          <h2>Financial overview</h2>
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

      <div className="db-grid">
        <section className="card db-panel" aria-label="Recent activity">
          <div className="db-panel__head">
            <h2>Recent activity</h2>
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
            <h2>Application status</h2>
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
