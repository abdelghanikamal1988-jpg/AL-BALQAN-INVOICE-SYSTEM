import { useEffect, useState } from 'react';
import Icon from '../Icons/Icon.jsx';
import { formatNumber } from '../../utils/formatCurrency.js';
import { calculatePayment, statusClass } from '../../utils/paymentCalculator.js';
import { calculateVat, VAT_MODE, VAT_RATE_LABEL } from '../../utils/vat.js';
import { useLang } from '../../context/LangContext.jsx';

export default function PaymentSection({ form, errors, onChange }) {
  const { t } = useLang();
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
    <section className="card" aria-label={t('invoice.paymentSection')}>
      <div className="card__header">
        <span className="card__icon" aria-hidden="true"><Icon name="card" /></span>
        <h2>{t('invoice.paymentSection')}</h2>
      </div>
      <div className="card__body">
        <div className="form-grid">
          <div className={`field ${errors.total ? 'field--error' : ''}`}>
            <label htmlFor="total">{t('invoice.totalServiceLabel')}</label>
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
            <label htmlFor="paid">{t('invoice.amountPaidLabel')}</label>
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
                {t('invoice.errPaidExceeds')}
              </span>
            )}
          </div>
        </div>

        <fieldset className="field vat-fieldset">
          <legend className="field__legend">{t('invoice.vatLegend', { rate: VAT_RATE_LABEL })}</legend>
          <div className="vat-options">
            <label className="vat-option">
              <input
                type="radio"
                name="vatMode"
                value={VAT_MODE.NONE}
                checked={form.vatMode === VAT_MODE.NONE}
                onChange={() => setVatMode(VAT_MODE.NONE)}
              />
              <span>{t('invoice.vatNone')}</span>
            </label>
            <label className="vat-option">
              <input
                type="radio"
                name="vatMode"
                value={VAT_MODE.INCLUDED}
                checked={form.vatMode === VAT_MODE.INCLUDED}
                onChange={() => setVatMode(VAT_MODE.INCLUDED)}
              />
              <span>{t('invoice.vatIncluded')}</span>
            </label>
            <label className="vat-option">
              <input
                type="radio"
                name="vatMode"
                value={VAT_MODE.EXCLUDED}
                checked={form.vatMode === VAT_MODE.EXCLUDED}
                onChange={() => setVatMode(VAT_MODE.EXCLUDED)}
              />
              <span>{t('invoice.vatExcluded')}</span>
            </label>
          </div>
          <span className="field__hint">
            {form.vatMode === VAT_MODE.INCLUDED &&
              t('invoice.vatHintIncluded')}
            {form.vatMode === VAT_MODE.EXCLUDED &&
              t('invoice.vatHintExcluded')}
            {(!form.vatMode || form.vatMode === VAT_MODE.NONE) &&
              t('invoice.vatHintNone')}
          </span>
        </fieldset>

        <div className="payment-summary">
          {hasVat && (
            <>
              <div className="payment-summary__row">
                <span>{t('invoice.subtotal')}</span>
                <strong>AED {formatNumber(vat.subtotal)}</strong>
              </div>
              <div className="payment-summary__row">
                <span>{t('invoice.vatRate', { rate: VAT_RATE_LABEL })}</span>
                <strong>AED {formatNumber(vat.vat)}</strong>
              </div>
            </>
          )}
          <div className="payment-summary__row">
            <span>{t('common.total')}</span>
            <strong>AED {formatNumber(vat.grandTotal)}</strong>
          </div>
          <div className="payment-summary__row">
            <span>{t('invoice.remainingBalance')}</span>
            <strong>AED {formatNumber(calc.remaining)}</strong>
          </div>
          <div className="payment-summary__row payment-summary__row--status">
            <span>{t('common.status')}</span>
            <span className={`badge ${statusClass(calc.status)}`}>{t('invoice.status.' + calc.status)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
