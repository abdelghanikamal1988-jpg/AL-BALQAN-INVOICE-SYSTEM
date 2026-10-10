import { toFils, fromFils } from './money.js';
import { getSettings } from './settings.js';

export const VAT_RATE = 0.05;

export const VAT_MODE = {
  NONE: 'none',
  INCLUDED: 'included',
  EXCLUDED: 'excluded',
};

export function currentVatPercent() {
  return normalizeVatPercent(getSettings().vatRate);
}

export function normalizeVatPercent(rate) {
  if (rate === null || rate === undefined || rate === '') return currentVatPercentFallback();
  const n = Number(rate);
  if (!Number.isFinite(n) || n < 0) return 5;
  if (n > 100) return 100;
  return Math.round(n * 100) / 100;
}

function currentVatPercentFallback() {
  return 5;
}

export function vatRateLabel(rate = null) {
  const pct =
    rate === null || rate === undefined || rate === ''
      ? currentVatPercent()
      : normalizeVatPercent(rate);
  const rounded = Math.round(pct * 100) / 100;
  return `${rounded}%`;
}

export function calculateVat(total, vatMode, rate = null) {
  const pct = normalizeVatPercent(rate);
  const totalFils = toFils(total);

  let subtotalFils = totalFils;
  let vatFils = 0;

  if (vatMode === VAT_MODE.INCLUDED) {
    if (pct === 5) {
      subtotalFils = Math.round((totalFils * 100) / 105);
    } else {
      subtotalFils = Math.round(totalFils / (1 + pct / 100));
    }
    vatFils = totalFils - subtotalFils;
  } else if (vatMode === VAT_MODE.EXCLUDED) {
    if (pct === 5) {
      vatFils = Math.round((totalFils * 5) / 100);
    } else {
      vatFils = Math.round((totalFils * pct) / 100);
    }
    subtotalFils = totalFils;
  }

  return {
    subtotal: fromFils(subtotalFils),
    vat: fromFils(vatFils),
    grandTotal: fromFils(subtotalFils + vatFils),
    rate: pct,
  };
}

export function invoicePaymentBreakdown(payment = {}) {
  const vatMode = payment.vatMode || VAT_MODE.NONE;
  if (vatMode === VAT_MODE.NONE) {
    return {
      subtotal: payment.total,
      vat: 0,
      grandTotal: payment.total,
      paid: payment.paid,
      rate: 0,
    };
  }
  if (
    payment.grandTotal !== null &&
    payment.grandTotal !== undefined &&
    payment.subtotal !== null &&
    payment.subtotal !== undefined &&
    payment.vat !== null &&
    payment.vat !== undefined
  ) {
    return {
      subtotal: payment.subtotal,
      vat: payment.vat,
      grandTotal: payment.grandTotal,
      paid: payment.paid,
      rate:
        payment.vatRate === null || payment.vatRate === undefined
          ? null
          : normalizeVatPercent(payment.vatRate),
    };
  }
  const vat = calculateVat(payment.total, vatMode, payment.vatRate ?? null);
  return {
    subtotal: vat.subtotal,
    vat: vat.vat,
    grandTotal: vat.grandTotal,
    paid: payment.paid,
    rate: vat.rate,
  };
}
