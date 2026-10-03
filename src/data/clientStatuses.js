/**
 * AL BALQAN — Client application statuses.
 * Single source for the form, list, detail page and PDF.
 */

export const CLIENT_STATUSES = [
  'NEW',
  'DOCUMENTS SUBMITTED',
  'SUBMITTED',
  'UNDER REVIEW',
  'APPROVED',
  'REJECTED',
];

export const DEFAULT_CLIENT_STATUS = 'NEW';

export function statusClass(status) {
  switch (status) {
    case 'NEW':
      return 'cbadge--new';
    case 'DOCUMENTS SUBMITTED':
      return 'cbadge--docs';
    case 'SUBMITTED':
      return 'cbadge--submitted';
    case 'UNDER REVIEW':
      return 'cbadge--review';
    case 'APPROVED':
      return 'cbadge--approved';
    case 'REJECTED':
      return 'cbadge--rejected';
    default:
      return 'cbadge--new';
  }
}
