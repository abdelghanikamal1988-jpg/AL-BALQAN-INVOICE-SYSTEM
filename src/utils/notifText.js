/**
 * Turns a stored notification row into the sentence shown in the bell.
 *
 * Kept outside the component so the wording rules (which payload fields a
 * type reads, and the generic fallback when a payload is empty) are plain
 * unit-testable logic instead of JSX.
 */

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
  return item.type;
}
