import { useEffect, useState } from 'react';
import { formatNumber } from '../../utils/formatCurrency.js';
import { calculatePayment, statusLabel, statusClass } from '../../utils/paymentCalculator.js';
import { calculateVat, VAT_MODE, VAT_RATE_LABEL } from '../../utils/vat.js';

export default function PaymentSection({ form, errors, onChange }) {
  const [totalInput, setTotalInput] = useState('');
  const [paidInput, setPaidInput] = useState('');

  useEffect(() => {
    setTotalInput(form.total ? String(form.total) : '');
  }, [form.total]);

  useEffect(() => {
    setPaidInput(form.paid ? String(form.paid) : '');
  }, [form.paid]);

  const setTotal = (value) => {
    setTotalInput(value);
    onChange('total', value);
  };

  const setPaid = (value) => {
    setPaidInput(value);
    onChange('paid', value);
  };

  const setVatMode = (mode) => onChange('vatMode', mode);

  const normalize = (value) => String(value).replace(/[^\d.]/g, '');

  const onTotalBlur = () => {
    const cleaned = normalize(totalInput);
    setTotalInput(cleaned);
    onChange('total', cleaned);
  };

  const onPaidBlur = () => {
    const cleaned = normalize(paidInput);
    setPaidInput(cleaned);
    onChange('paid', cleaned);
  };

  const vat = calculateVat(form.total, form.vatMode);
  const calc = calculatePayment(vat.grandTotal, form.paid);
  const paidExceeds = Number(form.paid) > Number(vat.grandTotal);
  const hasVat = form.vatMode && form.vatMode !== VAT_MODE.NONE;

  return (
    <section className="card" aria-label="Payment Details">
      <div className="card__header">
        <span className="card__icon" aria-hidden="true">💳</span>
        <h2>Payment Details</h2>
      </div>
      <div className="card__body">
        <div className="form-grid">
          <div className={`field ${errors.total ? 'field--error' : ''}`}>
            <label htmlFor="total">Total Service (AED) *</label>
            <input
              id="total"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={totalInput}
              onChange={(e) => setTotal(e.target.value)}
              onBlur={onTotalBlur}
              placeholder="0.00"
            />
            {errors.total && <span className="field__error">{errors.total}</span>}
          </div>

          <div className={`field ${paidExceeds ? 'field--error' : ''}`}>
            <label htmlFor="paid">Amount Paid (AED)</label>
            <input
              id="paid"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={paidInput}
              onChange={(e) => setPaid(e.target.value)}
              onBlur={onPaidBlur}
              placeholder="0.00"
            />
            {paidExceeds && (
              <span className="field__error">
                Paid amount cannot be greater than the total.
              </span>
            )}
          </div>
        </div>

        <fieldset className="field vat-fieldset">
          <legend className="field__legend">VAT (UAE · {VAT_RATE_LABEL})</legend>
          <div className="vat-options">
            <label className="vat-option">
              <input
                type="radio"
                name="vatMode"
                value={VAT_MODE.NONE}
                checked={form.vatMode === VAT_MODE.NONE}
                onChange={() => setVatMode(VAT_MODE.NONE)}
              />
              <span>No VAT</span>
            </label>
            <label className="vat-option">
              <input
                type="radio"
                name="vatMode"
                value={VAT_MODE.INCLUDED}
                checked={form.vatMode === VAT_MODE.INCLUDED}
                onChange={() => setVatMode(VAT_MODE.INCLUDED)}
              />
              <span>Included in total</span>
            </label>
            <label className="vat-option">
              <input
                type="radio"
                name="vatMode"
                value={VAT_MODE.EXCLUDED}
                checked={form.vatMode === VAT_MODE.EXCLUDED}
                onChange={() => setVatMode(VAT_MODE.EXCLUDED)}
              />
              <span>Added on top</span>
            </label>
          </div>
          <span className="field__hint">
            {form.vatMode === VAT_MODE.INCLUDED &&
              'The total you entered already includes VAT.'}
            {form.vatMode === VAT_MODE.EXCLUDED &&
              'VAT is added on top of the total you entered.'}
            {(!form.vatMode || form.vatMode === VAT_MODE.NONE) &&
              'No value added tax is applied.'}
          </span>
        </fieldset>

        <div className="payment-summary">
          {hasVat && (
            <>
              <div className="payment-summary__row">
                <span>Subtotal</span>
                <strong>AED {formatNumber(vat.subtotal)}</strong>
              </div>
              <div className="payment-summary__row">
                <span>VAT ({VAT_RATE_LABEL})</span>
                <strong>AED {formatNumber(vat.vat)}</strong>
              </div>
            </>
          )}
          <div className="payment-summary__row">
            <span>Total</span>
            <strong>AED {formatNumber(vat.grandTotal)}</strong>
          </div>
          <div className="payment-summary__row">
            <span>Remaining Balance</span>
            <strong>AED {formatNumber(calc.remaining)}</strong>
          </div>
          <div className="payment-summary__row payment-summary__row--status">
            <span>Status</span>
            <span className={`badge ${statusClass(calc.status)}`}>{statusLabel(calc.status)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
