/**
 * Local access log: every sign-in / sign-out attempt (successful or not)
 * is appended to a ring buffer in localStorage so the dashboard can show a
 * "Access logs" table for all accounts that used this browser.
 *
 * Scope note: this is a browser-side log — entries exist on the device
 * where the events happened. A server-side audit would need a Supabase
 * table written from a privileged context.
 */

const KEY = 'albalqan:access-log';
const MAX = 100;

export function getAccessLogs() {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (err) {
    return [];
  }
}

export function recordAccess({ action, account = '', details = '' }) {
  try {
    const list = getAccessLogs();
    list.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: new Date().toISOString(),
      action,
      account: String(account || '').trim() || '—',
      details,
    });
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch (err) {
    /* storage unavailable — logging must never break auth */
  }
}
