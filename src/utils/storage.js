/**
 * Storage service — invoices live in Supabase, the draft lives in the
 * signed-in user's `user_data` row.
 *
 * This is the ONLY module the UI imports. Swap the implementation here
 * without touching any component.
 */

import { formatDate, formatTime } from './formatDate.js';
import { calculateVat, VAT_MODE } from './vat.js';
import {
  dbFetchAll,
  dbFetchOne,
  dbInsert,
  dbUpdateBackup,
  dbDelete,
  dbRestore,
  dbFetchDeleted,
  dbInsertMany,
} from '../lib/invoiceRepo.js';
import {
  readDraft,
  writeDraft,
  clearDraftCache,
} from '../lib/userData.js';

/* ----------------------- Invoices (Supabase) ----------------------- */

export async function getInvoices() {
  return dbFetchAll();
}

export async function getInvoiceById(id) {
  return dbFetchOne(id);
}

export async function saveInvoice(invoice) {
  return dbInsert(invoice);
}

export async function updateInvoice(invoice) {
  return dbUpdateBackup(invoice.id, invoice);
}

export async function deleteInvoice(id) {
  await dbDelete(id);
}

/** Brings a soft-deleted invoice back. */
export async function restoreInvoice(id) {
  return dbRestore(id);
}

/** Soft-deleted invoices, for the admin recycle bin. */
export async function getDeletedInvoices() {
  return dbFetchDeleted();
}

/**
 * Case-insensitive search. Fetch once, filter in memory — enough for a
 * small business volume of invoices.
 */
export async function searchInvoices(query) {
  const all = await dbFetchAll();
  return filterInvoices(all, query);
}

/**
 * Pure in-memory filter over an already loaded list — used by the invoice
 * history filters without touching the database again.
 */
export function filterInvoices(list, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return list;
  return (list || []).filter((inv) => {
    const haystack = [
      inv.invoiceNumber,
      inv.customer?.name,
      inv.customer?.passport,
      inv.customer?.phone,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export async function importInvoices(incoming) {
  const all = await dbFetchAll();
  const existingIds = new Set(all.map((inv) => inv.id));
  const fresh = incoming.filter(
    (inv) => inv && inv.id && !existingIds.has(inv.id)
  );
  if (fresh.length > 0) await dbInsertMany(fresh);
  return fresh.length;
}

/**
 * One-time migration: copy any invoices already saved in localStorage into
 * the database, then clear the local copy so it cannot resurrect invoices
 * that were later deleted in the cloud.
 */
export async function migrateLocalInvoices() {
  try {
    const raw = localStorage.getItem('albalqan_invoices');
    if (!raw) return 0;
    const local = JSON.parse(raw);
    if (!Array.isArray(local) || local.length === 0) return 0;

    const all = await dbFetchAll();
    const existingIds = new Set(all.map((inv) => inv.id));
    const fresh = local.filter((inv) => inv && inv.id && !existingIds.has(inv.id));

    let added = 0;
    if (fresh.length > 0) {
      await dbInsertMany(fresh);
      added = fresh.length;
    }
    /* One-time import: once the local copy has been handled it is removed,
       so invoices deleted in the cloud can never be brought back from this
       device on the next sign-in. */
    localStorage.removeItem('albalqan_invoices');
    return added;
  } catch (err) {
    return 0;
  }
}

/* ----------------------- Draft (user_data row) ----------------------- */

export function getDraft() {
  return readDraft();
}

export function saveDraft(draft) {
  writeDraft(draft);
}

export function clearDraft() {
  clearDraftCache();
}

/* ----------------------- In-memory helpers ----------------------- */

export function createInvoiceObject(formData, number, linkedClient) {
  const now = new Date();
  const vatMode = formData.vatMode || VAT_MODE.NONE;
  const vat = calculateVat(formData.total, vatMode);
  const linked =
    linkedClient && linkedClient.id
      ? {
          /* The invoice remembers which file it belongs to, so a repeat
             customer can be found from either side: the client record or
             the invoice. Legacy invoices simply have no `client` key. */
          id: linkedClient.id,
          name: linkedClient.name || formData.name || '',
          fileNo: linkedClient.fileNo || '',
        }
      : null;
  const billedTo =
    formData.billedType === 'agent' && String(formData.billedName || '').trim()
      ? {
          /* The invoice is issued to the agent who collected the money;
             a direct customer leaves the key out entirely. */
          type: 'agent',
          name: String(formData.billedName).trim(),
        }
      : null;
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `inv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    invoiceNumber: number,
    issueDate: formatDate(now),
    issueTime: formatTime(now),
    customer: {
      name: formData.name,
      nationality: formData.nationality,
      passport: formData.passport,
      phone: formData.phone,
      email: formData.email,
    },
    ...(linked ? { client: linked } : {}),
    ...(billedTo ? { billedTo } : {}),
    travel: {
      destination: formData.destination,
      service: formData.service,
      residenceType: formData.residenceType,
    },
    payment: {
      total: formData.total,
      vatMode,
      vat: vat.vat,
      subtotal: vat.subtotal,
      grandTotal: vat.grandTotal,
      vatRate: vat.rate,
      paid: formData.paid,
    },
    notes: formData.notes,
  };
}