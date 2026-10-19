import destinations from './destinations.js';

/**
 * Destination options offered on a client record — the same five countries
 * the invoice form uses, so a client's destination always matches an
 * invoice destination one-to-one.
 */
export const CLIENT_DESTINATIONS = destinations.map((d) => d.label);

/**
 * Service options offered on a client record. Kept separate from the
 * invoice's `services.js`: a client asks for a visa pathway, while an
 * invoice bills for a delivered product, and the two lists differ.
 */
export const CLIENT_SERVICES = ['Tourist Visa', 'Labor Contract', 'Resident Visa'];
