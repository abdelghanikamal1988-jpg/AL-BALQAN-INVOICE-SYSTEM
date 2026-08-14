/**
 * Monetary precision helpers.
 * Money is always handled in integer fils (1 AED = 100 fils)
 * to avoid floating point errors like 0.1 + 0.2 = 0.30000000000000004.
 */

export function toFils(value) {
  const n = Number(value);
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100);
}

export function fromFils(fils) {
  return fils / 100;
}
