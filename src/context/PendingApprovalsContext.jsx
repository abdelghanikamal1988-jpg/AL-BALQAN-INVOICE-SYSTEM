/**
 * Admin inbox for pending edit approvals.
 *
 * Mounted once in Shell: keeps the queue of `pending_edits` rows (status =
 * pending) in one place so the Header bell and the Dashboard banner can
 * share a single fetch, and renders the review modal for approve/reject.
 * Non-admins get an empty context (count 0, no bell).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { useToast } from '../components/Toast/ToastProvider.jsx';
import Modal from '../components/Modal/Modal.jsx';
import PendingReviewModal from '../components/PendingReview/PendingReviewModal.jsx';
import Icon from '../components/Icons/Icon.jsx';
import { dbFetchPending, dbApprovePending, dbRejectPending } from '../lib/pendingRepo.js';
import { loadUserNames } from '../lib/profiles.js';
import { dbFetchClient } from '../lib/clientRepo.js';
import { getInvoiceById } from '../utils/storage.js';
import { clientFullName } from '../utils/clients.js';

const PendingApprovalsContext = createContext(null);

const REFRESH_MS = 60 * 1000;

function labelOf(row) {
  const payload = row.payload || {};
  if (row.entity_type === 'invoice') {
    return `${payload.invoiceNumber || 'Invoice'} — ${payload.customer?.name || 'customer'}`;
  }
  return clientFullName(payload) || 'Client';
}

export function PendingApprovalsProvider({ children }) {
  const { isAdmin } = useAuth();
  const toast = useToast();

  const [rows, setRows] = useState([]);
  const [names, setNames] = useState({});
  const [listOpen, setListOpen] = useState(false);
  const [review, setReview] = useState(null);
  const [current, setCurrent] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAdmin) {
      setRows([]);
      setNames({});
      return;
    }
    try {
      const list = await dbFetchPending(null, { status: 'pending' });
      const nameMap = await loadUserNames(list.map((row) => row.user_id)).catch(() => ({}));
      setRows(list);
      setNames(nameMap);
    } catch (err) {
      console.warn('[approvals] pending list unavailable:', err);
    }
  }, [isAdmin]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /* Keep the badge fresh: when the window regains focus + every minute. */
  useEffect(() => {
    if (!isAdmin) return undefined;
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(refresh, REFRESH_MS);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(timer);
    };
  }, [isAdmin, refresh]);

  const openReview = useCallback(async (row) => {
    setReview(row);
    setCurrent(null);
    try {
      const record =
        row.entity_type === 'invoice'
          ? await getInvoiceById(row.entity_id)
          : await dbFetchClient(row.entity_id);
      setCurrent(record);
    } catch (err) {
      console.warn('[approvals] record could not be loaded for the diff:', err);
    }
  }, []);

  const handleApprove = async () => {
    if (!review) return;
    setBusy(true);
    try {
      await dbApprovePending(review);
      toast.success('Edit approved and applied.');
      setReview(null);
      refresh();
    } catch (err) {
      console.error(err);
      toast.error(`Unable to apply the edit. (${err.message || 'please try again'})`);
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!review) return;
    setBusy(true);
    try {
      await dbRejectPending(review.id);
      toast.info('Proposal rejected — the record keeps its current values.');
      setReview(null);
      refresh();
    } catch (err) {
      console.error(err);
      toast.error(`Unable to reject the proposal. (${err.message || 'please try again'})`);
    } finally {
      setBusy(false);
    }
  };

  const value = useMemo(
    () => ({
      count: rows.length,
      rows,
      names,
      refresh,
      openApprovals: () => setListOpen(true),
    }),
    [rows, names, refresh]
  );

  return (
    <PendingApprovalsContext.Provider value={value}>
      {children}

      {/* Inbox: every proposal waiting for this admin. */}
      {listOpen && (
        <Modal
          className="appr-modal"
          title={`Awaiting your approval (${rows.length})`}
          onClose={() => setListOpen(false)}
          actions={
            <button type="button" className="btn btn--neutral" onClick={() => setListOpen(false)}>
              Close
            </button>
          }
        >
          {rows.length === 0 ? (
            <p className="appr-row__empty">Nothing is waiting for approval right now.</p>
          ) : (
            <div className="appr-list">
              {rows.map((row) => (
                <div className="appr-row" key={row.id}>
          <span className="appr-row__icon" aria-hidden="true">
            <Icon name={row.entity_type === 'invoice' ? 'receipt' : 'user'} />
          </span>
                  <span className="appr-row__info">
                    <span className="appr-row__title">{labelOf(row)}</span>
                    <span className="appr-row__meta">
                      {row.entity_type === 'invoice' ? 'Invoice edit' : 'Client edit'} ·{' '}
                      {names[row.user_id] || '—'} · {new Date(row.created_at).toLocaleString()}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => openReview(row)}
                  >
                    Review
                  </button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Side-by-side diff + approve / reject. */}
      {review && (
        <PendingReviewModal
          pending={review}
          current={current}
          submitterName={names[review.user_id] || '—'}
          entityType={review.entity_type}
          isAdmin
          busy={busy}
          onApprove={handleApprove}
          onReject={handleReject}
          onClose={() => setReview(null)}
        />
      )}
    </PendingApprovalsContext.Provider>
  );
}

export function usePendingApprovals() {
  const ctx = useContext(PendingApprovalsContext);
  if (!ctx) throw new Error('usePendingApprovals must be used inside <PendingApprovalsProvider>');
  return ctx;
}
