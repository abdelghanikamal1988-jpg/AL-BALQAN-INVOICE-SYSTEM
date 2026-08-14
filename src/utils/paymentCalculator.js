/**
 * Payment calculation.
 * Single source of truth for the payment status.
 *
 * calculatePayment(total, paid) -> { total, paid, remaining, status }
 *
 * Status:
 *  - UNPAID           paid === 0
 *  - PARTIALLY_PAID   paid > 0 && paid < total
 *  - PAID             paid === total
 */

import { toFils, fromFils } from './money.js';

export const PAYMENT_STATUS = {
  UNPAID: 'UNPAID',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
};

export function calculatePayment(total, paid) {
  const totalFils = toFils(total);
  const paidFils = toFils(paid);

  const clampedPaidFils = Math.min(paidFils, totalFils);

  let status;
  if (paidFils === 0) {
    status = PAYMENT_STATUS.UNPAID;
  } else if (paidFils >= totalFils) {
    status = PAYMENT_STATUS.PAID;
  } else {
    status = PAYMENT_STATUS.PARTIALLY_PAID;
  }

  return {
    total: fromFils(totalFils),
    paid: fromFils(clampedPaidFils),
    remaining: fromFils(totalFils - clampedPaidFils),
    status,
  };
}

export function statusLabel(status) {
  switch (status) {
    case PAYMENT_STATUS.UNPAID:
      return 'UNPAID';
    case PAYMENT_STATUS.PARTIALLY_PAID:
      return 'PARTIALLY PAID';
    case PAYMENT_STATUS.PAID:
      return 'PAID';
    default:
      return 'UNPAID';
  }
}

export function statusClass(status) {
  switch (status) {
    case PAYMENT_STATUS.PAID:
      return 'badge--paid';
    case PAYMENT_STATUS.PARTIALLY_PAID:
      return 'badge--partial';
    default:
      return 'badge--unpaid';
  }
}
