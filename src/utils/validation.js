/**
 * Input validation & sanitization helpers.
 */

/** Collapse extra whitespace: "Ahmed     Mohamed" -> "Ahmed Mohamed" */
export function normalizeName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function isEmailValid(value) {
  const v = String(value || '').trim();
  if (!v) return true; // optional
  // eslint-disable-next-line no-useless-escape
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

export function isPhoneValid(value) {
  const v = String(value || '').trim();
  if (!v) return true; // optional
  return /^[0-9+()\-\s.]{7,20}$/.test(v);
}

/**
 * Sanitize characters not allowed in a file name:
 * / \ : * ? " < > |  — and trim trailing dots/spaces.
 */
export function sanitizeFilenamePart(value) {
  return String(value || '')
    .replace(/[\/\\:*?"<>|]/g, '')
    .replace(/[\s.]+$/g, '')
    .trim();
}

export function isEmptyField(value) {
  return String(value || '').trim() === '';
}

/** Same floor the admin panel enforces when it creates or resets an account. */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Checks a "set a new password" form (reset link / change password).
 * Returns { ok: true } or { ok: false, error: 'short' | 'mismatch' }.
 */
export function validateNewPassword(password, confirm) {
  const pw = String(password ?? '');
  const cf = String(confirm ?? '');
  if (pw.length < PASSWORD_MIN_LENGTH) return { ok: false, error: 'short' };
  if (pw !== cf) return { ok: false, error: 'mismatch' };
  return { ok: true };
}
