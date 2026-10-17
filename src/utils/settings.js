import company from '../data/company.js';
import {
  readSettingsCache,
  writeSettingsCache,
  clearSettingsCache,
} from '../lib/userData.js';

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

export function getSettings() {
  const stored = readSettingsCache();
  const out = {};
  SETTINGS_FIELDS.forEach((key) => {
    const value = stored[key];
    out[key] = value === undefined || value === null ? DEFAULTS[key] : value;
  });
  out.vatRate = normalizeVatRate(out.vatRate);
  out.invoicePrefix = sanitizeInvoicePrefix(out.invoicePrefix);
  return out;
}

export function hasStoredSettings() {
  return Object.keys(readSettingsCache()).length > 0;
}

export function saveSettings(patch) {
  const next = { ...getSettings(), ...patch };
  next.vatRate = normalizeVatRate(next.vatRate);
  next.invoicePrefix = sanitizeInvoicePrefix(next.invoicePrefix);
  writeSettingsCache(next);
  return next;
}

export function resetSettings() {
  clearSettingsCache();
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
