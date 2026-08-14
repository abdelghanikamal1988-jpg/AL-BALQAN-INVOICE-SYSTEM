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
