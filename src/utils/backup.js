/**
 * Full-data backup — downloads everything the signed-in user can read as a
 * single JSON file.
 *
 * Row Level Security decides the scope: an admin reads every user's rows,
 * an employee reads only their own. No extra privilege is granted here, so
 * the export can never leak more than the app already shows.
 */

import { getInvoices, importInvoices } from './storage.js';
import { dbFetchClients, dbFetchAgents, dbInsertClient, dbInsertAgent } from '../lib/clientRepo.js';
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

/**
 * Reads a backup file the user picked and returns a preview of what would
 * be imported, without writing anything. Throws on a malformed file.
 */
export function parseBackupText(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('backup_invalid_json');
  }
  if (!data || data.format !== 'albalqan-backup') {
    throw new Error('backup_wrong_format');
  }
  if (!Number.isInteger(data.version) || data.version > 1) {
    throw new Error('backup_unsupported_version');
  }
  return data;
}

/**
 * Restores a parsed backup. Rows whose id already exists are skipped so the
 * import can never duplicate or overwrite live data — it only fills gaps.
 * Returns per-section counts of what was actually added.
 */
export async function restoreBackup(data) {
  const invoicesAdded = await importInvoices(Array.isArray(data.invoices) ? data.invoices : []);

  const existingClients = await dbFetchClients().catch(() => []);
  const clientIds = new Set(existingClients.map((c) => c.id));
  let clientsAdded = 0;
  for (const client of Array.isArray(data.clients) ? data.clients : []) {
    if (!client?.id || clientIds.has(client.id)) continue;
    try {
      await dbInsertClient(client);
      clientIds.add(client.id);
      clientsAdded += 1;
    } catch {
      /* one bad row must not abort the whole restore */
    }
  }

  const existingAgents = await dbFetchAgents().catch(() => []);
  const agentNames = new Set(existingAgents.map((a) => (a?.name || '').toUpperCase()));
  let agentsAdded = 0;
  for (const agent of Array.isArray(data.agents) ? data.agents : []) {
    const name = typeof agent === 'string' ? agent : agent?.name;
    if (!name || agentNames.has(name.toUpperCase())) continue;
    try {
      await dbInsertAgent(name);
      agentNames.add(name.toUpperCase());
      agentsAdded += 1;
    } catch {
      /* skip */
    }
  }

  return { invoicesAdded, clientsAdded, agentsAdded };
}
