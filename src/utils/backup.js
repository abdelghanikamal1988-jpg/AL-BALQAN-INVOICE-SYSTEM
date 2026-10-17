/**
 * Full-data backup — downloads everything the signed-in user can read as a
 * single JSON file.
 *
 * Row Level Security decides the scope: an admin reads every user's rows,
 * an employee reads only their own. No extra privilege is granted here, so
 * the export can never leak more than the app already shows.
 */

import { getInvoices } from './storage.js';
import { dbFetchClients, dbFetchAgents } from '../lib/clientRepo.js';
import { dbFetchConsultations } from '../lib/consultationRepo.js';
import { getAccessLogs } from './accessLog.js';
import { getSettings } from './settings.js';
import { readPrefs } from '../lib/userData.js';

/**
 * Collects every durable business record into one object.
 * Returns `{ ok, data }`; a failed section is reported as `null` so one
 * unavailable table never blocks the rest of the backup.
 */
export async function collectBackup() {
  const settle = (promise) =>
    promise.then((value) => ({ ok: true, value })).catch((err) => ({ ok: false, err }));

  const [invoices, clients, agents, consultations, logs] = await Promise.all([
    settle(getInvoices()),
    settle(dbFetchClients()),
    settle(dbFetchAgents()),
    settle(dbFetchConsultations()),
    settle(getAccessLogs()),
  ]);

  const failed = [];
  if (!invoices.ok) failed.push('invoices');
  if (!clients.ok) failed.push('clients');
  if (!agents.ok) failed.push('agents');
  if (!consultations.ok) failed.push('consultations');
  if (!logs.ok) failed.push('accessLogs');

  return {
    ok: failed.length === 0,
    failed,
    data: {
      format: 'albalqan-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: getSettings(),
      prefs: readPrefs(),
      invoices: invoices.ok ? invoices.value : null,
      clients: clients.ok ? clients.value : null,
      agents: agents.ok ? agents.value : null,
      consultations: consultations.ok ? consultations.value : null,
      accessLogs: logs.ok ? logs.value : null,
    },
  };
}

/** Triggers a browser download of the collected backup. */
export async function exportFullBackup() {
  const { ok, failed, data } = await collectBackup();
  if (!ok && data.invoices === null && data.clients === null) {
    throw new Error(`backup: ${failed.join(', ')}`);
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `albalqan-full-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  return { ok, failed, counts: countRows(data) };
}

function countRows(data) {
  const n = (v) => (Array.isArray(v) ? v.length : 0);
  return {
    invoices: n(data.invoices),
    clients: n(data.clients),
    agents: n(data.agents),
    consultations: n(data.consultations),
    accessLogs: n(data.accessLogs),
  };
}
