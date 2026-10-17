/**
 * WhatsApp helpers.
 *
 * The business sits in the UAE (+971) but most of its clients dial in
 * from Egypt (+20), so a bare local number has to be guessed carefully:
 *   010 / 011 / 012 / 015 ...  ->  Egyptian mobile  (unambiguous)
 *   050 - 058                  ->  UAE mobile
 *   02 / 03 / 04 / 06 ...      ->  landline, assumed UAE (company home)
 * A number that was typed with an explicit + or 00 is never re-prefixed.
 */

export function whatsappDigits(phone) {
  const raw = String(phone || '').trim();
  let d = raw.replace(/\D/g, '');
  if (!d) return '';

  /* Explicit international dialling (+… or 00…) — leave it exactly as typed. */
  const explicit = raw.includes('+') || d.startsWith('00');
  d = d.replace(/^00/, '');
  if (explicit) return d;

  /* Local number with the leading trunk zero. */
  if (d.startsWith('0')) {
    /* Egyptian mobile: 010 / 011 / 012 / 015 + eight digits. */
    if (/^01[0125]\d{8}$/.test(d)) return `20${d.slice(1)}`;
    /* Everything else is assumed to be a UAE local number. */
    return `971${d.slice(1)}`;
  }

  /* No trunk zero: Egyptian mobile written as 1X + eight digits. */
  if (/^1[0125]\d{8}$/.test(d)) return `20${d}`;
  /* Nine digits is the classic UAE local length (05X mobile). */
  if (/^5\d{8}$/.test(d)) return `971${d}`;

  return d;
}

export function whatsappShareUrl(phone, text) {
  const encoded = encodeURIComponent(String(text || ''));
  const digits = whatsappDigits(phone);
  return digits
    ? `https://wa.me/${digits}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}
