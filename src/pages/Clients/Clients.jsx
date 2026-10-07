import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icons/Icon.jsx';
import Modal from '../../components/Modal/Modal.jsx';
import ConfirmAuthModal from '../../components/ConfirmAuth/ConfirmAuthModal.jsx';
import Can from '../../components/Can/Can.jsx';
import PendingReviewModal from '../../components/PendingReview/PendingReviewModal.jsx';
import { useToast } from '../../components/Toast/ToastProvider.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePendingApprovals } from '../../context/PendingApprovalsContext.jsx';
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

export default function Clients() {
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
        toast.error(
          'Unable to load clients. Run supabase/clients.sql in the Supabase SQL Editor first.'
        );
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
      toast.success('Edit approved and applied.');
      setReview(null);
      refresh();
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
      toast.info('Proposal rejected — the client keeps its current values.');
      setReview(null);
      refresh();
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
      refresh();
      refreshApprovals();
    } catch (err) {
      console.error(err);
      toast.error(`Unable to cancel the request. (${err.message || 'please try again'})`);
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
    toast.info('Client deleted.');
  };

  const ownerRows = invoiceOwner ? invoicesOf(invoiceOwner) : [];

  return (
    <div className="page page--wide clients-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">CRM</p>
          <h1>Clients</h1>
          <p className="subtitle">Client applications, documents and linked invoices.</p>
        </div>
        <div className="page-header__right">
          <ul className="crumbs">
            <li>
              <Link to="/">Home</Link>
            </li>
            <li>
              <span className="crumbs__cur">Clients</span>
            </li>
          </ul>
          <Can perm="page:clients.new">
            <Link to="/clients/new" className="btn btn--primary cl-new-client">
              <Icon name="plus" aria-hidden="true" />
              New Client
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
              <span className="statc__label">Clients</span>
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
                  <span className="statc__label">{s}</span>
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

      <div className="cl-toolbar">
        <div className="field cl-toolbar__search">
          <label htmlFor="client-search">Search</label>
          <input
            id="client-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, passport, country, agent, status…"
          />
        </div>
        <div className="field cl-toolbar__agent">
          <label htmlFor="client-agent">Referral agent</label>
          <select id="client-agent" value={agent} onChange={(e) => setAgent(e.target.value)}>
            <option value={ANY}>All agents</option>
            <option value="CUSTOMER">CUSTOMER</option>
            {agents.map((a) => (
              <option key={a.id} value={a.name}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field cl-toolbar__filter">
          <label htmlFor="client-country">Nationality / country</label>
          <select id="client-country" value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value={ANY}>All countries</option>
            {countryOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div className="field cl-toolbar__filter">
          <label htmlFor="client-status">Status</label>
          <select id="client-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value={ANY}>All statuses</option>
            {CLIENT_STATUSES.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div className="field cl-toolbar__filter">
          <label htmlFor="client-invoices">Invoices</label>
          <select
            id="client-invoices"
            value={invoiceFilter}
            onChange={(e) => setInvoiceFilter(e.target.value)}
          >
            <option value={ANY}>Any</option>
            <option value="WITH">With invoices</option>
            <option value="WITHOUT">Without invoices</option>
          </select>
        </div>

        {hasFilters && (
          <button
            type="button"
            className="btn btn--neutral btn--sm cl-toolbar__reset"
            onClick={clearFilters}
          >
            Clear filters
          </button>
        )}
      </div>

      <p className="cl-summary">
        {loading ? 'Loading…' : `${visible.length} of ${clients.length} clients`}
      </p>

      {loading ? (
        <div className="card">
          <div className="loading-row">
            <span className="spinner" aria-hidden="true" />
            Loading clients…
          </div>
        </div>
      ) : visible.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state__icon" aria-hidden="true"><Icon name="users" /></div>
            <h3>{clients.length === 0 ? 'No clients yet' : 'No matching clients'}</h3>
            <p>
              {clients.length === 0
                ? 'Create your first client record to see it here.'
                : 'Try a different search term or clear the active filters.'}
            </p>
            {clients.length === 0 && (
              <Can perm="page:clients.new">
                <Link to="/clients/new" className="btn btn--primary">
                  Create Client
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
                  <th>Client</th>
                  <th>Passport</th>
                  <th>Country</th>
                  <th>Referral Agent</th>
                  <th>Status</th>
                  <th>Invoices</th>
                  <th>User</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((client) => {
                  const rows = invoicesOf(client);
                  const pendingFor = pendingByClient.get(client.id);
                  return (
                    <tr key={client.id}>
                      <td>
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
                      <td>
                        <span className="cl-passport">{client.passport || '—'}</span>
                      </td>
                      <td>{client.country || '—'}</td>
                      <td>{client.referralAgent || '—'}</td>
                      <td>
                        <span className={`cbadge ${statusClass(client.status)}`}>
                          {client.status || 'NEW'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn--neutral btn--sm"
                          onClick={() => setInvoiceOwner(client)}
                        >
                          {rows.length === 0 ? 'No invoice' : `${rows.length} invoice${rows.length > 1 ? 's' : ''}`}
                        </button>
                      </td>
                      <td>
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
                              title="This edit was rejected — the client kept its current values"
                            >
                              Edit rejected
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="actions-cell">
                        <div className="cl-actions">
                          <button
                            type="button"
                            className="icon-btn"
                            title="View client"
                            aria-label={`View ${clientFullName(client) || 'client'}`}
                            onClick={() => navigate(`/clients/${client.id}`)}
                          >
                            <Icon name="eye" />
                          </button>
                          <Can perm="action:client.save">
                            <button
                              type="button"
                              className="icon-btn"
                              title="Edit client"
                              aria-label={`Edit ${clientFullName(client) || 'client'}`}
                              onClick={() => navigate(`/clients/${client.id}/edit`)}
                            >
                              <Icon name="pencil" />
                            </button>
                          </Can>
                          <Can perm="action:client.delete">
                            <button
                              type="button"
                              className="icon-btn icon-btn--danger"
                              title="Delete client"
                              aria-label={`Delete ${clientFullName(client) || 'client'}`}
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
        Paid and remaining amounts are always read live from the invoice system — no payment
        data is stored in the client record.
      </p>

      {invoiceOwner && (
        <Modal
          title={`Invoices — ${clientFullName(invoiceOwner) || 'Client'}`}
          onClose={() => setInvoiceOwner(null)}
          actions={
            <button type="button" className="btn btn--primary" onClick={() => setInvoiceOwner(null)}>
              Close
            </button>
          }
        >
          {ownerRows.length === 0 ? (
            <div className="cd-empty">
              No invoice has been created for this client yet.
              <br />
              Create one in the Invoice System using passport number{' '}
              <strong>{invoiceOwner.passport || '—'}</strong>.
            </div>
          ) : (
            <table className="cl-modal-inv">
              <thead>
                <tr>
                  <th>Invoice No.</th>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Remaining</th>
                </tr>
              </thead>
              <tbody>
                {ownerRows.map((row) => (
                  <tr key={row.invoice.id}>
                    <td className="mono">{row.invoice.invoiceNumber}</td>
                    <td>{row.invoice.issueDate || '—'}</td>
                    <td>{formatCurrency(row.payment.grandTotal)}</td>
                    <td>{formatCurrency(row.calc.paid)}</td>
                    <td>{formatCurrency(row.calc.remaining)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal>
      )}

      {deleteTarget && !authPrompt && (
        <Modal
          title="Delete client?"
          danger
          onClose={() => setDeleteTarget(null)}
          actions={
            <>
              <button
                type="button"
                className="btn btn--neutral"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button type="button" className="btn btn--danger" onClick={() => setAuthPrompt(true)}>
                Delete Client
              </button>
            </>
          }
        >
          <p>
            This permanently removes <strong>{clientFullName(deleteTarget)}</strong>, their uploaded
            documents and the stored PDF. Invoice records are not affected. This cannot be undone.
          </p>
        </Modal>
      )}

      {deleteTarget && authPrompt && (
        <ConfirmAuthModal
          title="Confirm your identity"
          reason={`Enter your account credentials to permanently delete ${clientFullName(
            deleteTarget
          )} and their documents.`}
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
        <Link to="/clients/new" className="fab" title="New client" aria-label="New client">
          <Icon name="plus" />
        </Link>
      </Can>
    </div>
  );
}
