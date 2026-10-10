import company from '../data/company.js';

const SETTINGS_KEY = 'albalqan:settings';

const DEFAULTS = {
  companyName: company.name,
  shortName: company.shortName,
  legalName: company.legalName,
  licenseNo: company.licenseNo,
  trn: '',
  phone: company.phone,
  email: company.email,
  website: company.website,
  address: company.address,
  city: company.city,
  country: company.country,
  currency: company.currency || 'AED',
  vatRate: 5,
  invoicePrefix: 'INV',
  terms: '',
  bankDetails: '',
};

export const SETTINGS_FIELDS = Object.keys(DEFAULTS);

export function normalizeVatRate(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n * 100) / 100;
}

export function sanitizeInvoicePrefix(value) {
  const cleaned = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
  return cleaned || 'INV';
}

function readStored() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (err) {
    return null;
  }
}

export function getSettings() {
  const stored = readStored();
  const out = {};
  SETTINGS_FIELDS.forEach((key) => {
    const value = stored ? stored[key] : undefined;
    out[key] = value === undefined || value === null ? DEFAULTS[key] : value;
  });
  out.vatRate = normalizeVatRate(out.vatRate);
  out.invoicePrefix = sanitizeInvoicePrefix(out.invoicePrefix);
  return out;
}

export function hasStoredSettings() {
  return readStored() !== null;
}

export function saveSettings(patch) {
  const next = { ...getSettings(), ...patch };
  next.vatRate = normalizeVatRate(next.vatRate);
  next.invoicePrefix = sanitizeInvoicePrefix(next.invoicePrefix);
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch (err) {
    /* ignore quota / private mode */
  }
  return next;
}

export function resetSettings() {
  try {
    localStorage.removeItem(SETTINGS_KEY);
  } catch (err) {
    /* ignore */
  }
  return { ...DEFAULTS };
}

export function isConfigured() {
  const s = getSettings();
  return hasStoredSettings() && Boolean(String(s.trn || '').trim());
}

export function getCompany() {
  const s = getSettings();
  return {
    ...company,
    name: s.companyName || company.name,
    shortName: s.shortName || company.shortName,
    legalName: s.legalName || company.legalName,
    licenseNo: s.licenseNo || company.licenseNo,
    trn: s.trn,
    phone: s.phone || company.phone,
    email: s.email || company.email,
    website: s.website || company.website,
    address: s.address || company.address,
    city: s.city || company.city,
    country: s.country || company.country,
    currency: s.currency || company.currency,
  };
}
