/**
 * Currency formatting. Amounts are displayed as AED 0.00
 */

import company from '../data/company.js';

const formatter = new Intl.NumberFormat('en-AE', {
  style: 'currency',
  currency: 'AED',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const plainFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return `${company.currency} 0.00`;
  return formatter.format(n);
}

export function formatNumber(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return '0.00';
  return plainFormatter.format(n);
}
