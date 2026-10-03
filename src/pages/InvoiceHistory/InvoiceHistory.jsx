import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icons/Icon.jsx';
import InvoiceHistoryToolbar from '../../components/InvoiceHistory/InvoiceHistoryToolbar.jsx';
import InvoicePreview from '../../components/InvoicePreview/InvoicePreview.jsx';
import Modal from '../../components/Modal/Modal.jsx';
import ConfirmAuthModal from '../../components/ConfirmAuth/ConfirmAuthModal.jsx';
import Can from '../../components/Can/Can.jsx';
import PendingReviewModal from '../../components/PendingReview/PendingReviewModal.jsx';
import { useToast } from '../../components/Toast/ToastProvider.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePendingApprovals } from '../../context/PendingApprovalsContext.jsx';
import {
  dbFetchPending,
  dbApprovePending,
  dbRejectPending,
  dbWithdrawPending,
} from '../../lib/pendingRepo.js';
import { loadUserNames } from '../../lib/profiles.js';
import {
  getInvoices,
  deleteInvoice,
  filterInvoices,
  importInvoices,
} from '../../utils/storage.js';
import { calculatePayment, statusLabel, statusClass, PAYMENT_STATUS } from '../../utils/paymentCalculator.js';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { formatDateShort } from '../../utils/formatDate.js';
import { serviceLabel, destinationLabel } from '../../utils/labels.js';
import services from '../../data/services.js';
import destinations from '../../data/destinations.js';
import { exportInvoicePdf, printInvoicePdf } from '../../utils/pdf.js';
import { invoicePaymentBreakdown } from '../../utils/vat.js';

const ANY = '';

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

function paymentStatusOf(inv) {
  const breakdown = invoicePaymentBreakdown(inv.payment);
  return calculatePayment(breakdown.grandTotal, breakdown.paid).status;
}

function toPreviewForm(inv) {
  return {
    name: inv.customer?.name || '',
    nationality: inv.customer?.nationality || '',
    passport: inv.customer?.passport || '',
    phone: inv.customer?.phone || '',
    email: inv.customer?.email || '',
    destination: inv.travel?.destination || '',
    service: inv.travel?.service || '',
    residenceType: inv.travel?.residenceType || '',
    total: inv.payment?.total ?? '',
    paid: inv.payment?.paid ?? '',
    vatMode: inv.payment?.vatMode || 'none',
    notes: inv.notes || '',
    issueDateDisplay: inv.issueDate || '',
    issueTimeDisplay: inv.issueTime || '',
  };
}

export default function InvoiceHistory() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, isAdmin } = useAuth();
  const { refresh: refreshApprovals } = usePendingApprovals();
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState(ANY);
  const [nationality, setNationality] = useState(ANY);
  const [destination, setDestination] = useState(ANY);
  const [service, setService] = useState(ANY);
  const [status, setStatus] = useState(ANY);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [pendingList, setPendingList] = useState([]);
  const [userNames, setUserNames] = useState({});
  const [review, setReview] = useState(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [deletePrompt, setDeletePrompt] = useState(null);
  const [authPrompt, setAuthPrompt] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getInvoices()
      .then(async (list) => {
        if (active) setInvoices(list);
        /* Proposals of any status (own for users, all for admins) — the
           User column shows pending / approved / rejected, and display
           names. Both are best-effort: the list still works. */
        const pendings = await dbFetchPending('invoice', { status: 'any' }).catch(() => []);
        const names = await loadUserNames([
          ...list.map((inv) => inv.createdBy),
          ...pendings.map((p) => p.user_id),
        ]).catch(() => ({}));
        if (!active) return;
        setPendingList(pendings);
        setUserNames(names);
      })
      .catch(() => {
        if (active) setInvoices([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const nameOf = (uid) => {
    if (!uid) return '—';
    if (userNames[uid]) return userNames[uid];
    if (user && uid === user.id) return user.email || '—';
    return '—';
  };

  /* Newest proposal per invoice (RLS already limits what we can see). */
  const pendingByInvoice = useMemo(() => {
    const map = new Map();
    pendingList.forEach((row) => {
      if (!map.has(row.entity_id)) map.set(row.entity_id, row);
    });
    return map;
  }, [pendingList]);

  const handleApprove = async () => {
    if (!review) return;
    setReviewBusy(true);
    try {
      await dbApprovePending(review);
      toast.success('Edit approved and applied.');
      setReview(null);
      setRefreshKey((k) => k + 1);
      refreshApprovals();
    } catch (err) {
      console.error(err);
      toast.error(`Unable to apply the edit. (${err.message || 'please try again'})`);
    } finally {
      setReviewBusy(false);
    }
  };

  const handleReject = async () => {
    if (!review) return;
    setReviewBusy(true);
    try {
      await dbRejectPending(review.id);
      toast.info('Proposal rejected — the invoice keeps its current values.');
      setReview(null);
      setRefreshKey((k) => k + 1);
      refreshApprovals();
    } catch (err) {
      console.error(err);
      toast.error(`Unable to reject the proposal. (${err.message || 'please try again'})`);
    } finally {
      setReviewBusy(false);
    }
  };

  const handleWithdraw = async () => {
    if (!review) return;
    setReviewBusy(true);
    try {
      await dbWithdrawPending(review.id);
      toast.info('Your request was cancelled.');
      setReview(null);
      setRefreshKey((k) => k + 1);
      refreshApprovals();
    } catch (err) {
      console.error(err);
      toast.error(`Unable to cancel the request. (${err.message || 'please try again'})`);
    } finally {
      setReviewBusy(false);
    }
  };

  const periodOptions = (() => {
    const seen = new Map();
    invoices.forEach((inv) => {
      const key = String(inv.issueDate || '').slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(key) || seen.has(key)) return;
      const [y, m] = key.split('-').map(Number);
      const label = new Date(y, m - 1, 1)
        .toLocaleString('en-US', { month: 'long', year: 'numeric' })
        .toUpperCase();
      seen.set(key, label);
    });
    return [...seen.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([value, label]) => ({ value, label }));
  })();

  const nationalityOptions = (() => {
    const seen = new Set();
    invoices.forEach((inv) => {
      const value = String(inv.customer?.nationality || '').trim();
      if (value) seen.add(value);
    });
    return [...seen].sort((a, b) => a.localeCompare(b));
  })();

  const destinationOptions = (() => {
    const ids = new Set(invoices.map((inv) => inv.travel?.destination).filter(Boolean));
    return destinations.filter((d) => ids.has(d.id)).map((d) => ({ value: d.id, label: d.label }));
  })();

  const serviceOptions = (() => {
    const ids = new Set(invoices.map((inv) => inv.travel?.service).filter(Boolean));
    return services.filter((s) => ids.has(s.id)).map((s) => ({ value: s.id, label: s.label }));
  })();

  const visible = (() => {
    let list = filterInvoices(invoices, query);
    if (period) list = list.filter((inv) => String(inv.issueDate || '').slice(0, 7) === period);
    if (nationality)
      list = list.filter((inv) => String(inv.customer?.nationality || '').trim() === nationality);
    if (destination) list = list.filter((inv) => inv.travel?.destination === destination);
    if (service) list = list.filter((inv) => inv.travel?.service === service);
    if (status) list = list.filter((inv) => paymentStatusOf(inv) === status);
    return list;
  })();

  const totals = (() => {
    let paid = 0;
    let remaining = 0;
    visible.forEach((inv) => {
      const breakdown = invoicePaymentBreakdown(inv.payment);
      const calc = calculatePayment(breakdown.grandTotal, breakdown.paid);
      paid += Number(calc.paid) || 0;
      remaining += Number(calc.remaining) || 0;
    });
    return { paid: round2(paid), remaining: round2(remaining) };
  })();

  const hasFilters = Boolean(query || period || nationality || destination || service || status);

  const clearFilters = () => {
    setQuery('');
    setPeriod(ANY);
    setNationality(ANY);
    setDestination(ANY);
    setService(ANY);
    setStatus(ANY);
  };

  const handleExport = async () => {
    let all;
    try {
      all = await getInvoices();
    } catch (err) {
      toast.error('Unable to load invoices for export.');
      return;
    }
    if (all.length === 0) {
      toast.info('No invoices to export yet.');
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
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

  /** Runs after the password gate — any failure is shown inside that modal. */
  const performDelete = async () => {
    if (!deletePrompt) return;
    await deleteInvoice(deletePrompt.id);
    toast.info('Invoice deleted.');
    setRefreshKey((k) => k + 1);
  };

  /* ---------- Print / PDF actions ---------- */
  const handlePdf = (invoice) => {
    exportInvoicePdf(invoice)
      .then(() => toast.success('PDF exported successfully.'))
      .catch(() => toast.error('Unable to export PDF. Please try again or use Print.'));
  };

  const handlePrint = (invoice) => {
    printInvoicePdf(invoice)
      .then(() => {})
      .catch(() => toast.error("Unable to open the print dialog. Please use your browser's print command."));
  };

  return (
    <div className="page page--wide">
      <div className="page-header">
        <div>
          <h1>Invoice History</h1>
          <p className="subtitle">Search, view, edit, print or export saved invoices.</p>
        </div>
        <Can perm="page:invoice.create">
          <button type="button" className="btn btn--primary" onClick={() => navigate('/create')}>
            + New Invoice
          </button>
        </Can>
      </div>

      <InvoiceHistoryToolbar
        query={query}
        onChange={setQuery}
        onExport={handleExport}
        onImport={() => fileInputRef.current?.click()}
        onClear={query ? () => setQuery('') : null}
      />

      <div className="history-filters" aria-label="Invoice filters">
        <div className="field history-filters__field">
          <label htmlFor="inv-period">Date</label>
          <select id="inv-period" value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value={ANY}>All dates</option>
            {periodOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field history-filters__field">
          <label htmlFor="inv-nationality">Nationality</label>
          <select
            id="inv-nationality"
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
          >
            <option value={ANY}>All nationalities</option>
            {nationalityOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div className="field history-filters__field">
          <label htmlFor="inv-destination">Destination</label>
          <select
            id="inv-destination"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          >
            <option value={ANY}>All destinations</option>
            {destinationOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field history-filters__field">
          <label htmlFor="inv-service">Service</label>
          <select id="inv-service" value={service} onChange={(e) => setService(e.target.value)}>
            <option value={ANY}>All services</option>
            {serviceOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field history-filters__field">
          <label htmlFor="inv-status">Status</label>
          <select id="inv-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value={ANY}>All statuses</option>
            <option value={PAYMENT_STATUS.PAID}>PAID</option>
            <option value={PAYMENT_STATUS.PARTIALLY_PAID}>PARTIALLY PAID</option>
            <option value={PAYMENT_STATUS.UNPAID}>UNPAID</option>
          </select>
        </div>

        {hasFilters && (
          <button
            type="button"
            className="btn btn--neutral btn--sm history-filters__reset"
            onClick={clearFilters}
          >
            Clear filters
          </button>
        )}
      </div>

      {!loading && invoices.length > 0 && (
        <div className="history-summary" aria-label="Financial summary">
          <span className="history-summary__item">
            <span className="history-summary__label">Showing</span>
            <b>
              {visible.length} of {invoices.length}
            </b>
          </span>
          <span className="history-summary__item">
            <span className="history-summary__label">Total paid</span>
            <b>{formatCurrency(totals.paid)}</b>
          </span>
          <span className="history-summary__item">
            <span className="history-summary__label">Total remaining</span>
            <b>{formatCurrency(totals.remaining)}</b>
          </span>
        </div>
      )}

      {loading ? (
        <div className="card">
          <div className="loading-row">
            <span className="spinner" aria-hidden="true" />
            Loading invoices…
          </div>
        </div>
      ) : visible.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state__icon" aria-hidden="true"><Icon name="receipt" /></div>
            {invoices.length === 0 ? (
              <>
                <h3>No invoices yet</h3>
                <p>Create your first invoice to see it here.</p>
                <Can perm="page:invoice.create">
                  <button type="button" className="btn btn--primary" onClick={() => navigate('/create')}>
                    Create Invoice
                  </button>
                </Can>
              </>
            ) : (
              <>
                <h3>No matching invoices</h3>
                <p>Try a different search term or clear the active filters.</p>
                <button type="button" className="btn btn--primary" onClick={clearFilters}>
                  Clear filters
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="history-table-wrap">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Invoice No.</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Passport</th>
                  <th>Destination</th>
                  <th>Service</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Remaining</th>
                  <th>Status</th>
                  <th>User</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((inv) => {
                  const payment = invoicePaymentBreakdown(inv.payment);
                  const calc = calculatePayment(payment.grandTotal, payment.paid);
                  const pendingFor = pendingByInvoice.get(inv.id);
                  return (
                    <tr key={inv.id}>
                      <td className="mono">{inv.invoiceNumber}</td>
                      <td>{inv.issueDate || '—'}</td>
                      <td>{inv.customer?.name || '—'}</td>
                      <td>{inv.customer?.passport || '—'}</td>
                      <td>{destinationLabel(inv.travel?.destination)}</td>
                      <td>{serviceLabel(inv.travel?.service)}</td>
                      <td>{formatCurrency(calc.total)}</td>
                      <td>{formatCurrency(calc.paid)}</td>
                      <td>{formatCurrency(calc.remaining)}</td>
                      <td>
                        <span className={`badge ${statusClass(calc.status)}`}>
                          {statusLabel(calc.status)}
                        </span>
                      </td>
                      <td>
                        <div className="user-cell">
                          <span>{nameOf(inv.createdBy)}</span>
                          {inv.editedBy && inv.editedBy !== inv.createdBy && (
                            <span className="user-cell__sub"><Icon name="pencil" /> {nameOf(inv.editedBy)}</span>
                          )}
                          {pendingFor?.status === 'pending' && (
                            <button
                              type="button"
                              className="pending-chip"
                              onClick={() => setReview(pendingFor)}
                            >
                              Edit pending
                            </button>
                          )}
                          {pendingFor?.status === 'approved' && (
                            <span
                              className="pending-chip pending-chip--approved"
                              title="An administrator approved this edit"
                            >
                              Edit approved
                            </span>
                          )}
                          {pendingFor?.status === 'rejected' && (
                            <span
                              className="pending-chip pending-chip--rejected"
                              title="This edit was rejected — the invoice kept its current values"
                            >
                              Edit rejected
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="actions-cell">
                        <button
                          type="button"
                          className="btn btn--neutral btn--sm"
                          onClick={() => setViewInvoice(inv)}
                        >
                          View
                        </button>
                        <Can perm="action:invoice.save">
                          <button
                            type="button"
                            className="btn btn--secondary btn--sm"
                            onClick={() => navigate(`/edit/${inv.id}`)}
                          >
                            Edit
                          </button>
                        </Can>
                        <Can perm="action:invoice.export_pdf">
                          <button
                            type="button"
                            className="btn btn--secondary btn--sm"
                            onClick={() => handlePrint(inv)}
                          >
                            Print
                          </button>
                          <button
                            type="button"
                            className="btn btn--secondary btn--sm"
                            onClick={() => handlePdf(inv)}
                          >
                            PDF
                          </button>
                        </Can>
                        <Can perm="action:invoice.delete">
                          <button
                            type="button"
                            className="btn btn--danger btn--sm"
                            aria-label={`Delete invoice ${inv.invoiceNumber}`}
                            onClick={() => setDeletePrompt(inv)}
                          >
                            Delete
                          </button>
                        </Can>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="history-note">
        Invoices are stored securely in the cloud. Export Data regularly to keep a JSON backup.
      </div>

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

      {/* View modal */}
      {viewInvoice && (
        <Modal
          title={`Invoice ${viewInvoice.invoiceNumber} · ${formatDateShort(viewInvoice.issueDate)}`}
          onClose={() => setViewInvoice(null)}
          actions={
            <>
              <Can perm="action:invoice.export_pdf">
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => handlePdf(viewInvoice)}
                >
                  Export PDF
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => {
                    setViewInvoice(null);
                    handlePrint(viewInvoice);
                  }}
                >
                  Print
                </button>
              </Can>
            </>
          }
        >
          <div className="invoice-sheet-wrap" style={{ maxHeight: '70vh' }}>
            <InvoicePreview
              form={toPreviewForm(viewInvoice)}
              invoiceNumber={viewInvoice.invoiceNumber}
            />
          </div>
        </Modal>
      )}

      {/* Delete confirmation */}
      {deletePrompt && !authPrompt && (
        <Modal
          title="Delete invoice?"
          danger
          onClose={() => setDeletePrompt(null)}
          actions={
            <>
              <button type="button" className="btn btn--neutral" onClick={() => setDeletePrompt(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn--danger" onClick={() => setAuthPrompt(true)}>
                Delete
              </button>
            </>
          }
        >
          <p>
            This will permanently remove invoice {deletePrompt.invoiceNumber} from your
            account. This action cannot be undone.
          </p>
        </Modal>
      )}

      {/* Password gate before the invoice is actually deleted */}
      {deletePrompt && authPrompt && (
        <ConfirmAuthModal
          title="Confirm your identity"
          reason={`Enter your account credentials to permanently delete invoice ${deletePrompt.invoiceNumber}.`}
          onCancel={() => setAuthPrompt(false)}
          onConfirm={performDelete}
          onSuccess={() => {
            setDeletePrompt(null);
            setAuthPrompt(false);
          }}
        />
      )}

      {/* Pending edit review (approve / reject / withdraw) */}
      {review && (
        <PendingReviewModal
          pending={review}
          current={invoices.find((inv) => inv.id === review.entity_id) || null}
          submitterName={nameOf(review.user_id)}
          entityType="invoice"
          isAdmin={isAdmin}
          busy={reviewBusy}
          onApprove={handleApprove}
          onReject={handleReject}
          onWithdraw={handleWithdraw}
          onClose={() => setReview(null)}
        />
      )}
    </div>
  );
}
