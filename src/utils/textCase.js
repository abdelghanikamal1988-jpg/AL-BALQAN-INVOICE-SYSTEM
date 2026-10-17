/**
 * One text policy for the whole system:
 *   1. every free-text value is stored UPPERCASE
 *   2. Arabic script is rejected — the business records are Latin-only
 *      (names, countries and places travel onto PDFs and passports)
 *
 * The same three helpers are used by the client form, the invoice form,
 * the referral-agent box and the public consultation form so a value can
 * never be stored one way in one screen and another way in the next.
 */

/* Arabic + Arabic Supplement + Arabic Extended-A + both Presentation Forms
   + the Arabic letter mark. Ranges are built from code points so the source
   stays readable no matter how the file is transported. */
const ARABIC_BLOCKS = [
  [0x0600, 0x06ff],
  [0x0750, 0x077f],
  [0x08a0, 0x08ff],
  [0xfb50, 0xfdff],
  [0xfe70, 0xfeff],
];

const ARABIC_RE = new RegExp(
  '[' +
    ARABIC_BLOCKS.map(([from, to]) => String.fromCharCode(from) + '-' + String.fromCharCode(to)).join('') +
    String.fromCharCode(0x061c) +
    ']',
);

/** True when the value contains any Arabic-script character. */
export function hasArabic(value) {
  return ARABIC_RE.test(String(value ?? ''));
}

/**
 * Collapse whitespace and force uppercase. Arabic is left untouched so the
 * caller can still report it instead of silently mangling what the user typed.
 */
export function toUpperLatin(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/** Field keys whose value still carries Arabic script. */
export function arabicFieldKeys(values) {
  return Object.entries(values || {})
    .filter(([, value]) => hasArabic(value))
    .map(([key]) => key);
}

/**
 * Live input filter for controlled text inputs: returns the value as the
 * user should see it (whitespace collapsed, uppercased). Arabic is kept so
 * the field can flag it rather than swallow it.
 */
export function filterTextInput(value) {
  return toUpperLatin(value);
}
