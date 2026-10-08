import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icons/Icon.jsx';
import Modal from '../../components/Modal/Modal.jsx';
import ConfirmAuthModal from '../../components/ConfirmAuth/ConfirmAuthModal.jsx';
import Can from '../../components/Can/Can.jsx';
import PendingReviewModal from '../../components/PendingReview/PendingReviewModal.jsx';
import SkeletonRows from '../../components/Skeleton/SkeletonRows.jsx';
import { useToast } from '../../components/Toast/ToastProvider.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePendingApprovals } from '../../context/PendingApprovalsContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
import { dbFetchClients, dbDeleteClient, dbFetchAgents } from '../../lib/clientRepo.js';
import {
  dbFetchPending,
  dbApprovePending,
  dbRejectPending,
  dbWithdrawPending,
} from '../../lib/pendingRepo.js';
import { loadUserNames } from '../../lib/profiles.js';
import {
  filterClients,
  clientFullName,
  normalizePassport,
  buildInvoiceIndex,
} from '../../utils/clients.js';
import { removeClientFiles } from '../../utils/uploads.js';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { CLIENT_STATUSES, statusClass } from '../../data/clientStatuses.js';
import '../../styles/clients.css';

const ANY = '';

const STATUS_MOD = {
  NEW: 'new',
  'DOCUMENTS SUBMITTED': 'docs',
  SUBMITTED: 'submitted',
  'UNDER REVIEW': 'review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

const STATUS_I18N = {
  NEW: 'status.NEW',
  'DOCUMENTS SUBMITTED': 'status.DOCUMENTS',
  SUBMITTED: 'status.SUBMITTED',
  'UNDER REVIEW': 'status.UNDER_REVIEW',
  APPROVED: 'status.APPROVED',
  REJECTED: 'status.REJECTED',
};

export default function Clients() {
  const { t } = useLang();
  const toast = useToast();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { refresh: refreshApprovals } = usePendingApprovals();
  const [searchParams] = useSearchParams();

  const [clients, setClients] = useState([]);
  const [agents, setAgents] = useState([]);
  const [invoiceIndex, setInvoiceIndex] = useState(new Map());
  const [pendingList, setPendingList] = useState([]);
  const [userNames, setUserNames] = useState({});
  const [review, setReview] = useState(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [query, setQuery] = useState(() => searchParams.get('q') || '');
  const [agent, setAgent] = useState(ANY);
  const [country, setCountry] = useState(ANY);
  const [status, setStatus] = useState(ANY);
  const [invoiceFilter, setInvoiceFilter] = useState(ANY);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [invoiceOwner, setInvoiceOwner] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [authPrompt, setAuthPrompt] = useState(false);

  /* Deep link from the topbar search: /clients?q=… */
  useEffect(() => {
    setQuery(searchParams.get('q') || '');
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      dbFetchClients(),
      dbFetchAgents().catch((err) => {
        console.warn('referral_agents unavailable — run supabase/clients.sql', err);
        return [];
      }),
      buildInvoiceIndex().catch((err) => {
        console.warn('Invoice index unavailable', err);
        return new Map();
      }),
      dbFetchPending('client', { status: 'any' }).catch((err) => {
        console.warn('pending_edits unavailable — run supabase/approvals.sql', err);
        return [];
      }),
    ])
      .then(([list, agentList, index, pendings]) => {
        if (!active) return;
        setClients(list);
        setAgents(agentList);
        setInvoiceIndex(index);
        setPendingList(pendings);
        loadUserNames([
          ...list.map((c) => c.createdBy),
          ...pendings.map((p) => p.user_id),
        ])
          .catch(() => ({}))
          .then((names) => {
            if (active) setUserNames(names);
          });
      })
      .catch((err) => {
        if (!active) return;
        setClients([]);
        console.error(err);
        toast.error(t('clients.toastLoadError'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const invoicesOf = (client) => invoiceIndex.get(normalizePassport(client.passport)) || [];

  const visible = useMemo(() => {
    let list = filterClients(clients, query, agent);
    if (country) list = list.filter((c) => (c.country || '') === country);
    if (status) list = list.filter((c) => (c.status || 'NEW') === status);
    if (invoiceFilter === 'WITH') list = list.filter((c) => invoicesOf(c).length > 0);
    if (invoiceFilter === 'WITHOUT') list = list.filter((c) => invoicesOf(c).length === 0);
    return list;
  }, [clients, query, agent, country, status, invoiceFilter, invoiceIndex]);

  const countryOptions = useMemo(() => {
    const seen = new Set();
    clients.forEach((c) => {
      const value = String(c.country || '').trim();
      if (value) seen.add(value);
    });
    return [...seen].sort((a, b) => a.localeCompare(b));
  }, [clients]);

  const hasFilters = Boolean(query || agent || country || status || invoiceFilter);

  const clearFilters = () => {
    setQuery('');
    setAgent(ANY);
    setCountry(ANY);
    setStatus(ANY);
    setInvoiceFilter(ANY);
  };

  const refresh = () => setRefreshKey((k) => k + 1);

  const statusText = (s) => {
    const key = STATUS_I18N[s];
    return key ? t(key) : s || t('status.NEW');
  };

  const nameOf = (uid) => {
    if (!uid) return '—';
    if (userNames[uid]) return userNames[uid];
    if (user && uid === user.id) return user.email || '—';
    return '—';
  };

  /* Newest proposal per client (RLS already limits what we can see). */
  const pendingByClient = useMemo(() => {
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
      toast.success(t('clients.toastApproved'));
      setReview(null);
      refresh();
      refreshApprovals();
    } catch (err) {
      console.error(err);
      toast.error(
        t('clients.toastApplyError', { detail: err.message || t('clients.tryAgain') })
      );
    } finally {
      setReviewBusy(false);
    }
  };

  const handleReject = async () => {
    if (!review) return;
    setReviewBusy(true);
    try {
      await dbRejectPending(review.id);
      toast.info(t('clients.toastRejected'));
      setReview(null);
      refresh();
      refreshApprovals();
    } catch (err) {
      console.error(err);
      toast.error(
        t('clients.toastRejectError', { detail: err.message || t('clients.tryAgain') })
      );
    } finally {
      setReviewBusy(false);
    }
  };

  const handleWithdraw = async () => {
    if (!review) return;
    setReviewBusy(true);
    try {
      await dbWithdrawPending(review.id);
      toast.info(t('clients.toastWithdrawn'));
      setReview(null);
      refresh();
      refreshApprovals();
    } catch (err) {
      console.error(err);
      toast.error(
        t('clients.toastWithdrawError', { detail: err.message || t('clients.tryAgain') })
      );
    } finally {
      setReviewBusy(false);
    }
  };

  const stats = useMemo(() => {
    const counts = {};
    clients.forEach((c) => {
      const s = c.status || 'NEW';
      counts[s] = (counts[s] || 0) + 1;
    });
    return { total: clients.length, counts };
  }, [clients]);

  const initialsOf = (client) => {
    const parts = (clientFullName(client) || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length === 0) return '?';
    return parts
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase();
  };

  /** Runs after the password gate — any failure is shown inside that modal. */
  const performDelete = async () => {
    if (!deleteTarget) return;
    await dbDeleteClient(deleteTarget.id);
    try {
      await removeClientFiles(deleteTarget.id);
    } catch (err) {
      console.warn('Uploaded files could not be removed', err);
    }
    refresh();
    toast.info(t('clients.toastDeleted'));
  };

  const ownerRows = invoiceOwner ? invoicesOf(invoiceOwner) : [];

  return (
    <div className="page page--wide clients-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">CRM</p>
          <h1>{t('clients.title')}</h1>
          <p className="subtitle">{t('clients.subtitle')}</p>
        </div>
        <div className="page-header__right">
          <ul className="crumbs">
            <li>
              <Link to="/">{t('clients.home')}</Link>
            </li>
            <li>
              <span className="crumbs__cur">{t('clients.title')}</span>
            </li>
          </ul>
          <Can perm="page:clients.new">
            <Link to="/clients/new" className="btn btn--primary cl-new-client">
              <Icon name="plus" aria-hidden="true" />
              {t('clients.newClient')}
            </Link>
          </Can>
        </div>
      </div>

      {!loading && clients.length > 0 && (
        <div className="statc-row">
          <div className="statc">
            <span className="statc__tile statc__tile--slate" aria-hidden="true">
              <Icon name="users" />
            </span>
            <span className="statc__text">
              <span className="statc__label">{t('clients.title')}</span>
              <span className="statc__value">{stats.total}</span>
            </span>
            <span className="statc__chev" aria-hidden="true">
              <Icon name="chevronRight" />
            </span>
          </div>
          {CLIENT_STATUSES.filter((s) => stats.counts[s]).map((s) => {
            const mod = STATUS_MOD[s] || 'new';
            const tile =
              mod === 'approved'
                ? 'green'
                : mod === 'rejected'
                  ? 'red'
                  : mod === 'review'
                    ? 'purple'
                    : mod === 'docs' || mod === 'submitted'
                      ? 'amber'
                      : 'slate';
            const glyph =
              mod === 'approved'
                ? 'userCheck'
                : mod === 'rejected'
                  ? 'x'
                  : mod === 'review'
                    ? 'clock'
                    : 'user';
            return (
              <div className="statc" key={s}>
                <span className={`statc__tile statc__tile--${tile}`} aria-hidden="true">
                  <Icon name={glyph} />
                </span>
                <span className="statc__text">
                  <span className="statc__label">{statusText(s)}</span>
                  <span className="statc__value">{stats.counts[s]}</span>
                </span>
                <span className="statc__chev" aria-hidden="true">
                  <Icon name="chevronRight" />
                </span>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        className="btn btn--neutral filters-toggle"
        aria-expanded={filtersOpen}
        aria-controls="cl-filters"
        onClick={() => setFiltersOpen((v) => !v)}
      >
        {t('common.filters')}
        <Icon name="chevronDown" aria-hidden="true" />
      </button>

      <div id="cl-filters" className="cl-toolbar">
        <div className="field cl-toolbar__search">
          <label htmlFor="client-search">{t('common.search')}</label>
          <input
            id="client-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('clients.searchPlaceholder')}
          />
        </div>
        <div className={`cl-toolbar__group${filtersOpen ? '' : ' is-collapsed'}`}>
          <div className="field cl-toolbar__agent">
          <label htmlFor="client-agent">{t('clients.referralAgentField')}</label>
          <select id="client-agent" value={agent} onChange={(e) => setAgent(e.target.value)}>
            <option value={ANY}>{t('clients.allAgents')}</option>
            <option value="CUSTOMER">CUSTOMER</option>
            {agents.map((a) => (
              <option key={a.id} value={a.name}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field cl-toolbar__filter">
          <label htmlFor="client-country">{t('clients.countryFilter')}</label>
          <select id="client-country" value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value={ANY}>{t('clients.allCountries')}</option>
            {countryOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div className="field cl-toolbar__filter">
          <label htmlFor="client-status">{t('common.status')}</label>
          <select id="client-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value={ANY}>{t('clients.allStatuses')}</option>
            {CLIENT_STATUSES.map((opt) => (
              <option key={opt} value={opt}>
                {statusText(opt)}
              </option>
            ))}
          </select>
        </div>

        <div className="field cl-toolbar__filter">
          <label htmlFor="client-invoices">{t('clients.invoices')}</label>
          <select
            id="client-invoices"
            value={invoiceFilter}
            onChange={(e) => setInvoiceFilter(e.target.value)}
          >
            <option value={ANY}>{t('clients.any')}</option>
            <option value="WITH">{t('clients.withInvoices')}</option>
            <option value="WITHOUT">{t('clients.withoutInvoices')}</option>
          </select>
        </div>

        {hasFilters && (
          <button
            type="button"
            className="btn btn--neutral btn--sm cl-toolbar__reset"
            onClick={clearFilters}
          >
            {t('clients.clearFilters')}
          </button>
        )}
        </div>
      </div>

      <p className="cl-summary">
        {loading
          ? t('common.loading')
          : `${visible.length} ${t('common.of')} ${clients.length} ${t('clients.clientsWord')}`}
      </p>

      {loading ? (
        <div className="card">
          <div className="loading-row">
            <span className="spinner" aria-hidden="true" />
            {t('clients.loadingClients')}
          </div>
          <SkeletonRows rows={4} />
        </div>
      ) : visible.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state__icon" aria-hidden="true"><Icon name="users" /></div>
            <h3>{clients.length === 0 ? t('clients.emptyTitle') : t('clients.noMatchTitle')}</h3>
            <p>
              {clients.length === 0
                ? t('clients.emptyBody')
                : t('clients.noMatchBody')}
            </p>
            {clients.length === 0 && (
              <Can perm="page:clients.new">
                <Link to="/clients/new" className="btn btn--primary">
                  {t('clients.createClient')}
                </Link>
              </Can>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="cl-table-wrap">
            <table className="cl-table">
              <thead>
                <tr>
                  <th>{t('clients.client')}</th>
                  <th>{t('clients.passportLabel')}</th>
                  <th>{t('clients.colCountry')}</th>
                  <th>{t('clients.referralAgent')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('clients.invoices')}</th>
                  <th>{t('clients.colUser')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((client) => {
                  const rows = invoicesOf(client);
                  const pendingFor = pendingByClient.get(client.id);
                  return (
            <tr key={client.id}>
              <td data-label={t('clients.client')}>
                <div className="cl-identity">
                  <span className="cl-avatar" aria-hidden="true">
                    {initialsOf(client)}
                  </span>
                  <span>
                    <span className="cl-name">{clientFullName(client) || '—'}</span>
                    <span className="cl-sub">{client.sex || ''}</span>
                  </span>
                </div>
              </td>
              <td data-label={t('clients.passportLabel')}>
                <span className="cl-passport">{client.passport || '—'}</span>
              </td>
              <td data-label={t('clients.colCountry')}>{client.country || '—'}</td>
              <td data-label={t('clients.referralAgent')}>{client.referralAgent || '—'}</td>
              <td data-label={t('common.status')}>
                <span className={`cbadge ${statusClass(client.status)}`}>
                  {statusText(client.status)}
                </span>
              </td>
              <td data-label={t('clients.invoices')}>
                        <button
                          type="button"
                          className="btn btn--neutral btn--sm"
                          onClick={() => setInvoiceOwner(client)}
                        >
                          {rows.length === 0
                            ? t('clients.noInvoice')
                            : rows.length > 1
                              ? t('clients.invoiceMany', { n: rows.length })
                              : t('clients.invoiceOne', { n: rows.length })}
                        </button>
                      </td>
                      <td data-label={t('clients.colUser')}>
                        <div className="user-cell">
                          <span>{nameOf(client.createdBy)}</span>
                          {client.editedBy && client.editedBy !== client.createdBy && (
                            <span className="user-cell__sub"><Icon name="pencil" /> {nameOf(client.editedBy)}</span>
                          )}
                          {pendingFor?.status === 'pending' && (
                            <button
                              type="button"
                              className="pending-chip"
                              onClick={() => setReview(pendingFor)}
                            >
                              {t('clients.editPending')}
                            </button>
                          )}
                          {pendingFor?.status === 'approved' && (
                            <span
                              className="pending-chip pending-chip--approved"
                              title={t('clients.pendingApprovedTitle')}
                            >
                              {t('clients.editApproved')}
                            </span>
                          )}
                          {pendingFor?.status === 'rejected' && (
                            <span
                              className="pending-chip pending-chip--rejected"
                              title={t('clients.pendingRejectedTitle')}
                            >
                              {t('clients.editRejected')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="actions-cell" data-label={t('common.actions')}>
                        <div className="cl-actions">
                          <button
                            type="button"
                            className="icon-btn"
                            title={t('clients.viewClient')}
                            aria-label={t('clients.ariaView', {
                              name: clientFullName(client) || t('clients.clientFallback'),
                            })}
                            onClick={() => navigate(`/clients/${client.id}`)}
                          >
                            <Icon name="eye" />
                          </button>
                          <Can perm="action:client.save">
                            <button
                              type="button"
                              className="icon-btn"
                              title={t('clients.editClientAction')}
                              aria-label={t('clients.ariaEdit', {
                                name: clientFullName(client) || t('clients.clientFallback'),
                              })}
                              onClick={() => navigate(`/clients/${client.id}/edit`)}
                            >
                              <Icon name="pencil" />
                            </button>
                          </Can>
                          <Can perm="action:client.delete">
                            <button
                              type="button"
                              className="icon-btn icon-btn--danger"
                              title={t('clients.deleteClientAction')}
                              aria-label={t('clients.ariaDelete', {
                                name: clientFullName(client) || t('clients.clientFallback'),
                              })}
                              onClick={() => setDeleteTarget(client)}
                            >
                              <Icon name="trash" />
                            </button>
                          </Can>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="history-note">
        {t('clients.invoiceNote')}
      </p>

      {invoiceOwner && (
        <Modal
          title={t('clients.invoicesModalTitle', {
            name: clientFullName(invoiceOwner) || t('clients.client'),
          })}
          onClose={() => setInvoiceOwner(null)}
          actions={
            <button type="button" className="btn btn--primary" onClick={() => setInvoiceOwner(null)}>
              {t('common.close')}
            </button>
          }
        >
          {ownerRows.length === 0 ? (
            <div className="cd-empty">
              {t('clients.noInvoiceBody1')}
              <br />
              {t('clients.noInvoiceBody2')}{' '}
              <strong>{invoiceOwner.passport || '—'}</strong>.
            </div>
          ) : (
            <table className="cl-modal-inv">
              <thead>
                <tr>
                  <th>{t('clients.invoiceNo')}</th>
                  <th>{t('clients.date')}</th>
                  <th>{t('common.total')}</th>
                  <th>{t('clients.paid')}</th>
                  <th>{t('clients.remaining')}</th>
                </tr>
              </thead>
              <tbody>
                {ownerRows.map((row) => (
                  <tr key={row.invoice.id}>
                    <td className="mono" data-label={t('clients.invoiceNo')}>{row.invoice.invoiceNumber}</td>
                    <td data-label={t('clients.date')}>{row.invoice.issueDate || '—'}</td>
                    <td data-label={t('common.total')}>{formatCurrency(row.payment.grandTotal)}</td>
                    <td data-label={t('clients.paid')}>{formatCurrency(row.calc.paid)}</td>
                    <td data-label={t('clients.remaining')}>{formatCurrency(row.calc.remaining)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal>
      )}

      {deleteTarget && !authPrompt && (
        <Modal
          title={t('clients.deleteConfirmTitle')}
          danger
          onClose={() => setDeleteTarget(null)}
          actions={
            <>
              <button
                type="button"
                className="btn btn--neutral"
                onClick={() => setDeleteTarget(null)}
              >
                {t('common.cancel')}
              </button>
              <button type="button" className="btn btn--danger" onClick={() => setAuthPrompt(true)}>
                {t('clients.deleteClientBtn')}
              </button>
            </>
          }
        >
          <p>
            {t('clients.deleteListBody1')}{' '}
            <strong>{clientFullName(deleteTarget)}</strong>
            {t('clients.deleteListBody2')}
          </p>
        </Modal>
      )}

      {deleteTarget && authPrompt && (
        <ConfirmAuthModal
          title={t('clients.confirmIdentity')}
          reason={t('clients.deleteReason', { name: clientFullName(deleteTarget) })}
          onCancel={() => setAuthPrompt(false)}
          onConfirm={performDelete}
          onSuccess={() => {
            setDeleteTarget(null);
            setAuthPrompt(false);
          }}
        />
      )}

      {/* Pending edit review (approve / reject / withdraw) */}
      {review && (
        <PendingReviewModal
          pending={review}
          current={clients.find((c) => c.id === review.entity_id) || null}
          submitterName={nameOf(review.user_id)}
          entityType="client"
          isAdmin={isAdmin}
          busy={reviewBusy}
          onApprove={handleApprove}
          onReject={handleReject}
          onWithdraw={handleWithdraw}
          onClose={() => setReview(null)}
        />
      )}

      <Can perm="page:clients.new">
        <Link
          to="/clients/new"
          className="fab"
          title={t('clients.newClientLabel')}
          aria-label={t('clients.newClientLabel')}
        >
          <Icon name="plus" />
        </Link>
      </Can>
    </div>
  );
}
