/**
 * Turns a stored notification row into the sentence shown in the bell.
 *
 * Kept outside the component so the wording rules (which payload fields a
 * type reads, and the generic fallback when a payload is empty) are plain
 * unit-testable logic instead of JSX.
 */

/**
 * Who did it + what they did. Both halves are needed for the full
 * sentence; a payload missing either falls back to the plain line, so
 * an old or hand-written row never renders half a sentence.
 */
function named(item, t, key, genericKey) {
  const by = String(item.payload?.by || '').trim();
  const name = String(item.payload?.name || item.payload?.fileNo || '').trim();
  return by && name ? t(key, { by, name }) : t(genericKey);
}

export function notifText(item, t) {
  if (item.type === 'visa_published') {
    const name = item.payload?.name || item.payload?.fileNo || '';
    return name
      ? t('notif.visaPublished', { name })
      : t('notif.visaPublishedGeneric');
  }
  if (item.type === 'consultation_new') {
    const count = Number(item.payload?.count || 0);
    return count > 0
      ? t('notif.consultationNew', { count })
      : t('notif.consultationNewGeneric');
  }
  if (item.type === 'client_new') {
    return named(item, t, 'notif.clientNew', 'notif.clientNewGeneric');
  }
  if (item.type === 'invoice_new') {
    return named(item, t, 'notif.invoiceNew', 'notif.invoiceNewGeneric');
  }
  if (item.type === 'edit_submitted') {
    return named(item, t, 'notif.editSubmitted', 'notif.editSubmittedGeneric');
  }
  return item.type;
}
