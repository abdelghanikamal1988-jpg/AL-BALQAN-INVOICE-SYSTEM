/**
 * Shared label lookups for services and destinations.
 * Single source so the form, preview, history and PDF show the same labels.
 */

import services from '../data/services.js';
import destinations from '../data/destinations.js';

export function serviceLabel(id) {
  return services.find((s) => s.id === id)?.label || '—';
}

export function destinationLabel(id) {
  return destinations.find((d) => d.id === id)?.label || '—';
}
