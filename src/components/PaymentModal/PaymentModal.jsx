import { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from '../Modal/Modal.jsx';
import { useToast } from '../Toast/ToastProvider.jsx';
import { useLang } from '../../context/LangContext.jsx';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { formatDateShort } from '../../utils/formatDate.js';
import { invoicePaymentBreakdown } from '../../utils/vat.js';
import { calculatePayment } from '../../utils/paymentCalculator.js';
import {
  dbFetchPayments,
  dbAddPayment,
  dbDeletePayment,
  PAYMENT_METHODS,
} from '../../lib/paymentRepo.js';

const EMPTY = { amount: '', method: 'CASH', note: '', paidAt: '' };

/**
 * Records payments against one invoice. Every cent written here becomes a
 * ledger row; the invoice's payment.paid is re-synced from the ledger so
 * the number shown on the PDF can never drift away from the rows.
 */
export default function PaymentModal({ invoice, onClose, onPaidChange }) {
  const { t } = useLang();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  const breakdown = useMemo(
    () => invoicePaymentBreakdown(invoice?.payment),
    [invoice]
  );
  const calc = useMemo(
    () => calculatePayment(breakdown.grandTotal, breakdown.paid),
    [breakdown]
  );
  const remaining = Math.max(0, calc.remaining);

  const load = useCallback(async () => {
    if (!invoice?.id) return;
    setLoading(true);
    try {
      setRows(await dbFetchPayments(invoice.id));
    } catch {
      toast.error(t('invoice.paymentsLoadError'));
    } finally {
      setLoading(false);
    }
  }, [invoice?.id, t, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const ledgerTotal = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const shownPaid = rows.length ? Math.round(ledgerTotal * 100) / 100 : calc.paid;

  const set = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      setError(t('invoice.errPaymentAmount'));
      return;
    }
    const remainingAfter = Math.round((remaining - amount) * 100) / 100;
    if (amount > remaining + 0.009 && !rows.length) {
      setError(t('invoice.errPaymentExceeds'));
      return;
    }

    setSaving(true);
    try {
      await dbAddPayment({
        invoiceId: invoice.id,
        amount,
        method: form.method,
        note: form.note,
        paidAt: form.paidAt || undefined,
      });
      const fresh = await dbFetchPayments(invoice.id);
      setRows(fresh);
      const total = fresh.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
      const rounded = Math.round(total * 100) / 100;
      setForm(EMPTY);
      setError('');
      toast.success(t('invoice.toastPaymentSaved'));
      if (typeof onPaidChange === 'function') onPaidChange(rounded);
      void remainingAfter;
    } catch {
      toast.error(t('invoice.toastPaymentError'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    try {
      await dbDeletePayment(row.id);
      const fresh = await dbFetchPayments(invoice.id);
      setRows(fresh);
      const total = fresh.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      toast.success(t('invoice.toastPaymentRemoved'));
      if (typeof onPaidChange === 'function') onPaidChange(Math.round(total * 100) / 100);
    } catch {
      toast.error(t('invoice.toastPaymentError'));
    }
  };

  return (
    <Modal title="invoice.paymentsTitle" onClose={onClose}>
      <div className="pay-modal">
        <div className="pay-modal__summary">
          <div>
            <span className="pay-modal__label">{t('invoice.totalLabel')}</span>
            <strong>{formatCurrency(calc.total)}</strong>
          </div>
          <div>
            <span className="pay-modal__label">{t('invoice.amountPaidLabel')}</span>
            <strong>{formatCurrency(shownPaid)}</strong>
          </div>
          <div>
            <span className="pay-modal__label">{t('invoice.remainingLabel')}</span>
            <strong className={remaining <= 0 ? 'pay-modal__ok' : ''}>
              {formatCurrency(Math.max(0, Math.round((calc.total - shownPaid) * 100) / 100))}
            </strong>
          </div>
        </div>

        <form className="pay-modal__form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="pay-amount">{t('invoice.paymentAmountLabel')}</label>
            <input
              id="pay-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={set('amount')}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="pay-method">{t('invoice.paymentMethodLabel')}</label>
            <select id="pay-method" value={form.method} onChange={set('method')}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{t(`invoice.method.${m}`)}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pay-date">{t('invoice.paymentDateLabel')}</label>
            <input id="pay-date" type="date" value={form.paidAt} onChange={set('paidAt')} />
          </div>
          <div className="field pay-modal__note">
            <label htmlFor="pay-note">{t('invoice.paymentNoteLabel')}</label>
            <input id="pay-note" type="text" value={form.note} onChange={set('note')} maxLength={200} />
          </div>
          {error && <p className="field__error">{error}</p>}
          <div className="pay-modal__submit">
            <button type="submit" className="btn btn--primary btn--sm" disabled={saving}>
              {saving ? <span className="btn__spinner" aria-hidden="true" /> : t('invoice.addPayment')}
            </button>
          </div>
        </form>

        <div className="pay-modal__list">
          <h4>{t('invoice.paymentsHistory')}</h4>
          {loading ? (
            <p className="pay-modal__empty">{t('common.loading')}</p>
          ) : rows.length === 0 ? (
            <p className="pay-modal__empty">{t('invoice.noPaymentsYet')}</p>
          ) : (
            <table className="pay-modal__table">
              <thead>
                <tr>
                  <th>{t('invoice.paymentDateLabel')}</th>
                  <th>{t('invoice.paymentAmountLabel')}</th>
                  <th>{t('invoice.paymentMethodLabel')}</th>
                  <th>{t('invoice.paymentNoteLabel')}</th>
                  <th aria-label={t('common.actions')} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDateShort(row.paid_at)}</td>
                    <td>{formatCurrency(row.amount)}</td>
                    <td>{t(`invoice.method.${row.method}`)}</td>
                    <td>{row.note || '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn--danger btn--sm"
                        onClick={() => remove(row)}
                      >
                        {t('common.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Modal>
  );
}
