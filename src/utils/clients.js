/**
 * Client record helpers: validation, search/filter and invoice matching.
 *
 * The invoice system stays the single source of truth for money:
 * nothing is copied into the client record. Paid/remaining are computed
 * live from the stored invoices every time they are displayed.
 */

import { getInvoices } from './storage.js';
import { invoicePaymentBreakdown } from './vat.js';
import { calculatePayment } from './paymentCalculator.js';
import { CLIENT_STATUSES, DEFAULT_CLIENT_STATUS } from '../data/clientStatuses.js';

/** "ab-12 cd" -> "AB12CD" — used to match a client to its invoices. */
export function normalizePassport(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function clientFullName(client) {
  return [client?.firstName, client?.fatherName, client?.surname]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function newClientId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `cli-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyClientForm() {
  return {
    firstName: '',
    fatherName: '',
    surname: '',
    country: '',
    passport: '',
    dateOfBirth: '',
    dateOfIssue: '',
    dateOfExpiry: '',
    issuingPlace: '',
    placeOfBirth: '',
    sex: '',
    referralAgent: '',
    status: DEFAULT_CLIENT_STATUS,
  };
}

export function formToClient(form, { id, documents, pdfPath }) {
  return {
    id,
    firstName: String(form.firstName || '').replace(/\s+/g, ' ').trim(),
    fatherName: String(form.fatherName || '').replace(/\s+/g, ' ').trim(),
    surname: String(form.surname || '').replace(/\s+/g, ' ').trim(),
    country: String(form.country || '').replace(/\s+/g, ' ').trim(),
    passport: String(form.passport || '').replace(/\s+/g, ' ').trim(),
    dateOfBirth: form.dateOfBirth || '',
    dateOfIssue: form.dateOfIssue || '',
    dateOfExpiry: form.dateOfExpiry || '',
    issuingPlace: String(form.issuingPlace || '').replace(/\s+/g, ' ').trim(),
    placeOfBirth: String(form.placeOfBirth || '').replace(/\s+/g, ' ').trim(),
    sex: form.sex || '',
    referralAgent: form.referralAgent || '',
    status: CLIENT_STATUSES.includes(form.status) ? form.status : DEFAULT_CLIENT_STATUS,
    documents: documents || {},
    pdfPath: pdfPath || null,
    createdAt: form.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function clientToForm(client) {
  return {
    ...emptyClientForm(),
    firstName: client.firstName || '',
    fatherName: client.fatherName || '',
    surname: client.surname || '',
    country: client.country || '',
    passport: client.passport || '',
    dateOfBirth: client.dateOfBirth || '',
    dateOfIssue: client.dateOfIssue || '',
    dateOfExpiry: client.dateOfExpiry || '',
    issuingPlace: client.issuingPlace || '',
    placeOfBirth: client.placeOfBirth || '',
    sex: client.sex || '',
    referralAgent: client.referralAgent || '',
    status: client.status || DEFAULT_CLIENT_STATUS,
    createdAt: client.createdAt,
  };
}

const REQUIRED_FIELDS = [
  ['firstName', 'Name is required.'],
  ['fatherName', 'Father name is required.'],
  ['surname', 'Surname is required.'],
  ['country', 'Country name is required.'],
  ['passport', 'Passport number is required.'],
  ['dateOfBirth', 'Date of birth is required.'],
  ['dateOfIssue', 'Date of issue is required.'],
  ['dateOfExpiry', 'Date of expiry is required.'],
  ['issuingPlace', 'Issuing place is required.'],
  ['placeOfBirth', 'Place of birth is required.'],
  ['sex', 'Sex is required.'],
  ['referralAgent', 'Referral agent is required.'],
];

export function validateClientForm(form) {
  const errors = {};
  REQUIRED_FIELDS.forEach(([field, message]) => {
    if (!String(form[field] || '').trim()) errors[field] = message;
  });
  return errors;
}

/**
 * Case-insensitive search over every client field + optional agent filter.
 * Same approach as searchInvoices(): fetch once, filter in memory.
 */
export function filterClients(list, query, agent) {
  const q = String(query || '').trim().toLowerCase();
  const a = String(agent || '').trim();
  return list.filter((client) => {
    if (a && (client.referralAgent || '') !== a) return false;
    if (!q) return true;
    const haystack = [
      client.firstName,
      client.fatherName,
      client.surname,
      clientFullName(client),
      client.country,
      client.passport,
      client.issuingPlace,
      client.placeOfBirth,
      client.sex,
      client.referralAgent,
      client.status,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

/**
 * Invoices that belong to this client (matched on passport number).
 * Amounts are always recomputed from the invoice — never copied.
 */
export async function getClientInvoices(passport) {
  const key = normalizePassport(passport);
  if (!key) return [];
  const index = await buildInvoiceIndex();
  return index.get(key) || [];
}

/**
 * One pass over the invoices grouped by passport — lets a list of clients
 * show its invoices without re-reading the database for every row.
 */
export async function buildInvoiceIndex() {
  const all = await getInvoices();
  const index = new Map();
  all.forEach((inv) => {
    const key = normalizePassport(inv.customer?.passport);
    if (!key) return;
    const payment = invoicePaymentBreakdown(inv.payment);
    const calc = calculatePayment(payment.grandTotal, payment.paid);
    const rows = index.get(key) || [];
    rows.push({ invoice: inv, payment, calc });
    index.set(key, rows);
  });
  return index;
}
