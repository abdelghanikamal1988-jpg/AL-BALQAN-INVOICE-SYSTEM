import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icons/Icon.jsx';
import InvoiceHistoryToolbar from '../../components/InvoiceHistory/InvoiceHistoryToolbar.jsx';
import InvoicePreview from '../../components/InvoicePreview/InvoicePreview.jsx';
import Modal from '../../components/Modal/Modal.jsx';
import ConfirmAuthModal from '../../components/ConfirmAuth/ConfirmAuthModal.jsx';
import Can from '../../components/Can/Can.jsx';
import PendingReviewModal from '../../components/PendingReview/PendingReviewModal.jsx';
import SkeletonRows from '../../components/Skeleton/SkeletonRows.jsx';
import { useToast } from '../../components/Toast/ToastProvider.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
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
import { calculatePayment, statusClass, PAYMENT_STATUS } from '../../utils/paymentCalculator.js';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { formatDateShort } from '../../utils/formatDate.js';
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
  const { t } = useLang();
  const { refresh: refreshApprovals } = usePendingApprovals();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get('q') || '');
  const [period, setPeriod] = useState(ANY);
  const [nationality, setNationality] = useState(ANY);
  const [destination, setDestination] = useState(ANY);
  const [service, setService] = useState(ANY);
  const [status, setStatus] = useState(ANY);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [shown, setShown] = useState(30);
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

  /* Deep link from the topbar search: /history?q=… */
  useEffect(() => {
    setQuery(searchParams.get('q') || '');
  }, [searchParams]);

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
      toast.success(t('invoice.editApprovedToast'));
      setReview(null);
      setRefreshKey((k) => k + 1);
      refreshApprovals();
    } catch (err) {
      console.error(err);
      toast.error(t('invoice.applyEditFailed', { detail: err.message || t('invoice.pleaseTryAgain') }));
    } finally {
      setReviewBusy(false);
    }
  };

  const handleReject = async () => {
    if (!review) return;
    setReviewBusy(true);
    try {
      await dbRejectPending(review.id);
      toast.info(t('invoice.proposalRejected'));
      setReview(null);
      setRefreshKey((k) => k + 1);
      refreshApprovals();
    } catch (err) {
      console.error(err);
      toast.error(t('invoice.rejectFailed', { detail: err.message || t('invoice.pleaseTryAgain') }));
    } finally {
      setReviewBusy(false);
    }
  };

  const handleWithdraw = async () => {
    if (!review) return;
    setReviewBusy(true);
    try {
      await dbWithdrawPending(review.id);
      toast.info(t('invoice.requestCancelled'));
      setReview(null);
      setRefreshKey((k) => k + 1);
      refreshApprovals();
    } catch (err) {
      console.error(err);
      toast.error(t('invoice.cancelRequestFailed', { detail: err.message || t('invoice.pleaseTryAgain') }));
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
    return destinations.filter((d) => ids.has(d.id)).map((d) => ({ value: d.id, label: t('data.destination.' + d.id) }));
  })();

  const serviceOptions = (() => {
    const ids = new Set(invoices.map((inv) => inv.travel?.service).filter(Boolean));
    return services.filter((s) => ids.has(s.id)).map((s) => ({ value: s.id, label: t('data.service.' + s.id) }));
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
      toast.error(t('invoice.exportLoadFailed'));
      return;
    }
    if (all.length === 0) {
      toast.info(t('invoice.nothingToExport'));
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
    toast.success(t('invoice.backupExported'));
  };

  const handleImportFile = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      importInvoices(JSON.parse(reader.result))
        .then((added) => {
          if (added === 0) {
            toast.info(t('invoice.noNewInvoices'));
          } else {
            toast.success(added > 1 ? t('invoice.importedMany', { n: added }) : t('invoice.importedOne', { n: added }));
            setRefreshKey((k) => k + 1);
          }
        })
        .catch(() => {
          toast.error(t('invoice.importFailedFile'));
        });
    };
    reader.onerror = () => {
      toast.error(t('invoice.importFailedRead'));
    };
    reader.readAsText(file);
  };

  /** Runs after the password gate — any failure is shown inside that modal. */
  const performDelete = async () => {
    if (!deletePrompt) return;
    await deleteInvoice(deletePrompt.id);
    toast.info(t('invoice.deleted'));
    setRefreshKey((k) => k + 1);
  };

  /* ---------- Print / PDF actions ---------- */
  const handlePdf = (invoice) => {
    exportInvoicePdf(invoice)
      .then(() => toast.success(t('invoice.pdfExported')))
      .catch(() => toast.error(t('invoice.pdfExportFailed')));
  };

  const handlePrint = (invoice) => {
    printInvoicePdf(invoice)
      .then(() => {})
      .catch(() => toast.error(t('invoice.printDialogFailed')));
  };

  return (
    <div className="page page--wide">
      <div className="page-header">
        <div>
          <p className="eyebrow">{t('invoice.eyebrow')}</p>
          <h1>{t('invoice.historyTitle')}</h1>
          <p className="subtitle">{t('invoice.historySubtitle')}</p>
        </div>
        <div className="page-header__right">
          <ul className="crumbs">
            <li>
              <Link to="/">{t('invoice.home')}</Link>
            </li>
            <li>
              <span className="crumbs__cur">{t('invoice.eyebrow')}</span>
            </li>
          </ul>
          <Can perm="page:invoice.create">
            <button type="button" className="btn btn--primary" onClick={() => navigate('/create')}>
              <Icon name="plus" aria-hidden="true" />
              {t('invoice.newInvoice')}
            </button>
          </Can>
        </div>
      </div>

      <InvoiceHistoryToolbar
        query={query}
        onChange={setQuery}
        onExport={handleExport}
        onImport={() => fileInputRef.current?.click()}
        onClear={query ? () => setQuery('') : null}
      />

      <button
        type="button"
        className="btn btn--neutral filters-toggle"
        aria-expanded={filtersOpen}
        aria-controls="history-filters"
        onClick={() => setFiltersOpen((v) => !v)}
      >
        {t('common.filters')}
        <Icon name="chevronDown" aria-hidden="true" />
      </button>

      <div
        id="history-filters"
        className={`history-filters${filtersOpen ? '' : ' is-collapsed'}`}
        aria-label={t('invoice.filtersAria')}
      >
        <div className="field history-filters__field">
          <label htmlFor="inv-period">{t('invoice.date')}</label>
          <select id="inv-period" value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value={ANY}>{t('invoice.allDates')}</option>
            {periodOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field history-filters__field">
          <label htmlFor="inv-nationality">{t('invoice.nationality')}</label>
          <select
            id="inv-nationality"
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
          >
            <option value={ANY}>{t('invoice.allNationalities')}</option>
            {nationalityOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div className="field history-filters__field">
          <label htmlFor="inv-destination">{t('invoice.destination')}</label>
          <select
            id="inv-destination"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          >
            <option value={ANY}>{t('invoice.allDestinations')}</option>
            {destinationOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field history-filters__field">
          <label htmlFor="inv-service">{t('invoice.service')}</label>
          <select id="inv-service" value={service} onChange={(e) => setService(e.target.value)}>
            <option value={ANY}>{t('invoice.allServices')}</option>
            {serviceOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field history-filters__field">
          <label htmlFor="inv-status">{t('common.status')}</label>
          <select id="inv-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value={ANY}>{t('invoice.allStatuses')}</option>
            <option value={PAYMENT_STATUS.PAID}>{t('invoice.status.PAID')}</option>
            <option value={PAYMENT_STATUS.PARTIALLY_PAID}>{t('invoice.status.PARTIALLY_PAID')}</option>
            <option value={PAYMENT_STATUS.UNPAID}>{t('invoice.status.UNPAID')}</option>
          </select>
        </div>

        {hasFilters && (
          <button
            type="button"
            className="btn btn--neutral btn--sm history-filters__reset"
            onClick={clearFilters}
          >
            {t('invoice.clearFilters')}
          </button>
        )}
      </div>

      {!loading && invoices.length > 0 && (
        <div className="statc-row" aria-label={t('invoice.summaryAria')}>
          <div className="statc">
            <span className="statc__tile statc__tile--slate" aria-hidden="true">
              <Icon name="receipt" />
            </span>
            <span className="statc__text">
              <span className="statc__label">{t('invoice.showing')}</span>
              <span className="statc__value">
                {visible.length} {t('common.of')} {invoices.length}
              </span>
            </span>
            <span className="statc__chev" aria-hidden="true">
              <Icon name="chevronRight" />
            </span>
          </div>
          <div className="statc">
            <span className="statc__tile statc__tile--green" aria-hidden="true">
              <Icon name="card" />
            </span>
            <span className="statc__text">
              <span className="statc__label">{t('invoice.totalPaid')}</span>
              <span className="statc__value">{formatCurrency(totals.paid)}</span>
            </span>
            <span className="statc__chev" aria-hidden="true">
              <Icon name="chevronRight" />
            </span>
          </div>
          <div className="statc">
            <span className="statc__tile statc__tile--amber" aria-hidden="true">
              <Icon name="clock" />
            </span>
            <span className="statc__text">
              <span className="statc__label">{t('invoice.totalRemaining')}</span>
              <span className="statc__value">{formatCurrency(totals.remaining)}</span>
            </span>
            <span className="statc__chev" aria-hidden="true">
              <Icon name="chevronRight" />
            </span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card">
          <div className="loading-row">
            <span className="spinner" aria-hidden="true" />
            {t('invoice.loadingInvoices')}
          </div>
          <SkeletonRows rows={4} />
        </div>
      ) : visible.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state__icon" aria-hidden="true"><Icon name="receipt" /></div>
            {invoices.length === 0 ? (
              <>
                <h3>{t('invoice.emptyTitle')}</h3>
                <p>{t('invoice.emptyBody')}</p>
                <Can perm="page:invoice.create">
                  <button type="button" className="btn btn--primary" onClick={() => navigate('/create')}>
                    {t('invoice.createInvoice')}
                  </button>
                </Can>
              </>
            ) : (
              <>
                <h3>{t('invoice.noMatchTitle')}</h3>
                <p>{t('invoice.noMatchBody')}</p>
                <button type="button" className="btn btn--primary" onClick={clearFilters}>
                  {t('invoice.clearFilters')}
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
                  <th>{t('invoice.colInvoiceNo')}</th>
                  <th>{t('invoice.date')}</th>
                  <th>{t('invoice.colCustomer')}</th>
                  <th>{t('invoice.colPassport')}</th>
                  <th>{t('invoice.destination')}</th>
                  <th>{t('invoice.service')}</th>
                  <th>{t('common.total')}</th>
                  <th>{t('invoice.colPaid')}</th>
                  <th>{t('invoice.colRemaining')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('invoice.colUser')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {visible.slice(0, shown).map((inv) => {
                  const payment = invoicePaymentBreakdown(inv.payment);
                  const calc = calculatePayment(payment.grandTotal, payment.paid);
                  const pendingFor = pendingByInvoice.get(inv.id);
                  return (
            <tr key={inv.id}>
              <td className="mono" data-label={t('invoice.colInvoiceNo')}>{inv.invoiceNumber}</td>
              <td data-label={t('invoice.date')}>{inv.issueDate || '—'}</td>
              <td data-label={t('invoice.colCustomer')}>{inv.customer?.name || '—'}</td>
              <td data-label={t('invoice.colPassport')}>{inv.customer?.passport || '—'}</td>
              <td data-label={t('invoice.destination')}>{inv.travel?.destination ? t('data.destination.' + inv.travel.destination) : '—'}</td>
              <td data-label={t('invoice.service')}>{inv.travel?.service ? t('data.service.' + inv.travel.service) : '—'}</td>
              <td data-label={t('common.total')}>{formatCurrency(calc.total)}</td>
              <td data-label={t('invoice.colPaid')}>{formatCurrency(calc.paid)}</td>
              <td data-label={t('invoice.colRemaining')}>{formatCurrency(calc.remaining)}</td>
              <td data-label={t('common.status')}>
                <span className={`badge ${statusClass(calc.status)}`}>
                  {t('invoice.status.' + calc.status)}
                </span>
              </td>
              <td data-label={t('invoice.colUser')}>
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
                              {t('invoice.editPending')}
                            </button>
                          )}
                          {pendingFor?.status === 'approved' && (
                            <span
                              className="pending-chip pending-chip--approved"
                              title={t('invoice.editApprovedTitle')}
                            >
                              {t('invoice.editApproved')}
                            </span>
                          )}
                          {pendingFor?.status === 'rejected' && (
                            <span
                              className="pending-chip pending-chip--rejected"
                              title={t('invoice.editRejectedTitle')}
                            >
                              {t('invoice.editRejected')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="actions-cell" data-label={t('common.actions')}>
                        <button
                          type="button"
                          className="btn btn--neutral btn--sm"
                          onClick={() => setViewInvoice(inv)}
                        >
                          {t('invoice.view')}
                        </button>
                        <Can perm="action:invoice.save">
                          <button
                            type="button"
                            className="btn btn--secondary btn--sm"
                            onClick={() => navigate(`/edit/${inv.id}`)}
                          >
                            {t('common.edit')}
                          </button>
                        </Can>
                        <Can perm="action:invoice.export_pdf">
                          <button
                            type="button"
                            className="btn btn--secondary btn--sm"
                            onClick={() => handlePrint(inv)}
                          >
                            {t('common.print')}
                          </button>
                          <button
                            type="button"
                            className="btn btn--secondary btn--sm"
                            onClick={() => handlePdf(inv)}
                          >
                            {t('invoice.pdf')}
                          </button>
                        </Can>
                        <Can perm="action:invoice.delete">
                          <button
                            type="button"
                            className="btn btn--danger btn--sm"
                            aria-label={t('invoice.deleteInvoiceAria', { number: inv.invoiceNumber })}
                            onClick={() => setDeletePrompt(inv)}
                          >
                            {t('common.delete')}
                          </button>
                        </Can>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {visible.length > shown && (
            <div className="load-more">
              <button type="button" className="btn btn--neutral" onClick={() => setShown((n) => n + 50)}>
                {t('common.loadMore')} ({visible.length - shown})
              </button>
            </div>
          )}
        </div>
      )}

      <div className="history-note">
        {t('invoice.historyNote')}
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
          title={t('invoice.viewTitle', { number: viewInvoice.invoiceNumber, date: formatDateShort(viewInvoice.issueDate) })}
          onClose={() => setViewInvoice(null)}
          actions={
            <>
              <Can perm="action:invoice.export_pdf">
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => handlePdf(viewInvoice)}
                >
                  {t('invoice.exportPdf')}
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => {
                    setViewInvoice(null);
                    handlePrint(viewInvoice);
                  }}
                >
                  {t('common.print')}
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
          title={t('invoice.deleteTitle')}
          danger
          onClose={() => setDeletePrompt(null)}
          actions={
            <>
              <button type="button" className="btn btn--neutral" onClick={() => setDeletePrompt(null)}>
                {t('common.cancel')}
              </button>
              <button type="button" className="btn btn--danger" onClick={() => setAuthPrompt(true)}>
                {t('common.delete')}
              </button>
            </>
          }
        >
          <p>
            {t('invoice.deleteBody', { number: deletePrompt.invoiceNumber })}
          </p>
        </Modal>
      )}

      {/* Password gate before the invoice is actually deleted */}
      {deletePrompt && authPrompt && (
        <ConfirmAuthModal
          title={t('invoice.confirmIdentity')}
          reason={t('invoice.deleteAuthReason', { number: deletePrompt.invoiceNumber })}
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
