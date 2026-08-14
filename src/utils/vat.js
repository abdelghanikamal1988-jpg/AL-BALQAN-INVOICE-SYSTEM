/**
 * UAE VAT (5%) calculation.
 *
 * vatMode:
 *  - 'none'      : no VAT applied
 *  - 'included'  : the written total ALREADY includes VAT.
 *                  subtotal = total / 1.05, vat = total - subtotal, grandTotal = total
 *  - 'excluded'  : VAT is added ON TOP of the written total.
 *                  subtotal = total, vat = total * 0.05, grandTotal = subtotal + vat
 *
 * Money is handled in integer fils to avoid floating point errors.
 */

import { toFils, fromFils } from './money.js';

export const VAT_RATE = 0.05;
export const VAT_RATE_LABEL = '5%';

export const VAT_MODE = {
  NONE: 'none',
  INCLUDED: 'included',
  EXCLUDED: 'excluded',
};

/**
 * @param {number|string} total  the amount the user typed
 * @param {string} vatMode       one of VAT_MODE
 * @returns {{ subtotal, vat, grandTotal }}
 */
export function calculateVat(total, vatMode) {
  const totalFils = toFils(total);

  let subtotalFils = totalFils;
  let vatFils = 0;

  if (vatMode === VAT_MODE.INCLUDED) {
    // total already contains VAT → subtotal = total / 1.05
    subtotalFils = Math.round((totalFils * 100) / 105);
    vatFils = totalFils - subtotalFils;
  } else if (vatMode === VAT_MODE.EXCLUDED) {
    // VAT on top → vat = total * 5%
    vatFils = Math.round((totalFils * 5) / 100);
    subtotalFils = totalFils;
  }

  return {
    subtotal: fromFils(subtotalFils),
    vat: fromFils(vatFils),
    grandTotal: fromFils(subtotalFils + vatFils),
  };
}

/**
 * Effective payment figures for a saved invoice.
 * Handles old invoices that predate VAT (no vatMode -> no VAT).
 * @param {{total, paid, vatMode?, vat?, subtotal?, grandTotal?}} payment
 */
export function invoicePaymentBreakdown(payment = {}) {
  const vatMode = payment.vatMode || VAT_MODE.NONE;
  if (vatMode === VAT_MODE.NONE) {
    return {
      subtotal: payment.total,
      vat: 0,
      grandTotal: payment.total,
      paid: payment.paid,
    };
  }
  const vat = calculateVat(payment.total, vatMode);
  return {
    subtotal: vat.subtotal,
    vat: vat.vat,
    grandTotal: vat.grandTotal,
    paid: payment.paid,
  };
}
