/**
 * Per-user application state — settings, UI preferences and the invoice
 * draft. Everything that used to live in browser localStorage now lives in
 * the `user_data` table, keyed by the signed-in user, so the same account
 * sees the same state on every device.
 *
 * Reads stay synchronous (the existing call sites — invoice numbering, VAT,
 * PDF export, theme toggles — are all synchronous). A module-level cache is
 * hydrated once per session from Supabase; every write updates the cache
 * immediately and pushes the full row back in the background.
 */

import { supabase, isSupabaseConfigured } from './supabase.js';

const cache = {
  hydrated: false,
  userId: null,
  settings: {},
  prefs: {},
  draft: null,
};

const listeners = new Set();

function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (err) {
      /* a broken subscriber must not break the store */
    }
  });
}

export function subscribeUserData(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isUserDataHydrated() {
  return cache.hydrated;
}

/* ----------------------- persistence ----------------------- */

function persist() {
  if (!isSupabaseConfigured || !cache.userId) return;
  supabase
    .from('user_data')
    .upsert({
      user_id: cache.userId,
      settings: cache.settings,
      prefs: cache.prefs,
      draft: cache.draft,
      updated_at: new Date().toISOString(),
    })
    .then(({ error }) => {
      if (error) console.warn('[userData] save failed', error.message);
    });
}

/* ----------------------- legacy migration ----------------------- */

const LEGACY_SETTINGS_KEY = 'albalqan:settings';
const LEGACY_DRAFT_KEY = 'albalqan_invoice_draft';
const LEGACY_PREF_READERS = {
  theme: () => window.localStorage.getItem('ab-theme'),
  lang: () => window.localStorage.getItem('ab-lang'),
  sidebarCollapsed: () =>
    window.localStorage.getItem('ab-sidebar') === 'collapsed' ? '1' : null,
  onboardPdf: () =>
    window.localStorage.getItem('albalqan:onboard:pdf') === '1' ? '1' : null,
  onboardDismissed: () =>
    window.localStorage.getItem('albalqan:onboard:dismissed') === '1'
      ? '1'
      : null,
  lastSync: () => window.localStorage.getItem('albalqan:consult:lastSync'),
};

const LEGACY_PREF_KEYS = [
  'ab-theme',
  'ab-lang',
  'ab-sidebar',
  'albalqan:onboard:pdf',
  'albalqan:onboard:dismissed',
  'albalqan:consult:lastSync',
];

function readLegacyJson(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function removeLegacy(keys) {
  try {
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch (err) {
    /* ignore */
  }
}

/**
 * One-time bridge: if the database row is still empty, seed it from whatever
 * this browser had stored under the old localStorage keys, then clear those
 * keys so deleted cloud state can never resurrect from a stale device.
 */
function migrateLegacy() {
  const hadSettings = Object.keys(cache.settings).length > 0;
  const hadPrefs = Object.keys(cache.prefs).length > 0;
  const hadDraft = cache.draft !== null && cache.draft !== undefined;

  const legacySettings = readLegacyJson(LEGACY_SETTINGS_KEY);
  if (!hadSettings && legacySettings && typeof legacySettings === 'object') {
    cache.settings = { ...legacySettings };
    persist();
  }

  const legacyDraft = readLegacyJson(LEGACY_DRAFT_KEY);
  if (!hadDraft && legacyDraft && typeof legacyDraft === 'object') {
    cache.draft = legacyDraft;
    persist();
  }

  if (!hadPrefs) {
    const collected = {};
    Object.entries(LEGACY_PREF_READERS).forEach(([name, read]) => {
      let value = null;
      try {
        value = read();
      } catch (err) {
        value = null;
      }
      if (value === null || value === undefined) return;
      collected[name] =
        name === 'sidebarCollapsed' || name === 'onboardPdf' || name === 'onboardDismissed'
          ? true
          : value;
    });
    if (Object.keys(collected).length > 0) {
      cache.prefs = { ...cache.prefs, ...collected };
      persist();
    }
  }

  removeLegacy([LEGACY_SETTINGS_KEY, LEGACY_DRAFT_KEY, ...LEGACY_PREF_KEYS]);
}

/* ----------------------- lifecycle ----------------------- */

/**
 * Load the signed-in user's row into the cache. Called once per session by
 * AuthContext, before the app shell renders, so every synchronous read
 * afterwards sees real data. Without a session (public website, static
 * drill harnesses) the cache simply stays empty and defaults apply.
 */
export async function hydrateUserData() {
  if (!isSupabaseConfigured) {
    cache.hydrated = true;
    notify();
    return;
  }
  try {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user || null;
    cache.userId = user ? user.id : null;
    if (user) {
      const { data, error } = await supabase
        .from('user_data')
        .select('settings, prefs, draft')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) console.warn('[userData] load failed', error.message);
      cache.settings = data?.settings && typeof data.settings === 'object' ? data.settings : {};
      cache.prefs = data?.prefs && typeof data.prefs === 'object' ? data.prefs : {};
      cache.draft = data?.draft && typeof data.draft === 'object' ? data.draft : null;
      migrateLegacy();
    }
  } catch (err) {
    console.warn('[userData] hydrate failed', err);
  } finally {
    cache.hydrated = true;
    notify();
  }
}

/** Drop everything in memory so the next user on this browser starts clean. */
export function resetUserDataCache() {
  cache.hydrated = false;
  cache.userId = null;
  cache.settings = {};
  cache.prefs = {};
  cache.draft = null;
  notify();
}

/* ----------------------- settings ----------------------- */

export function readSettingsCache() {
  return { ...cache.settings };
}

export function writeSettingsCache(patch) {
  cache.settings = { ...cache.settings, ...patch };
  persist();
  notify();
}

export function clearSettingsCache() {
  cache.settings = {};
  persist();
  notify();
}

/* ----------------------- UI preferences ----------------------- */

export function readPref(key) {
  return cache.prefs[key];
}

export function readPrefs() {
  return { ...cache.prefs };
}

export function writePref(key, value) {
  cache.prefs = { ...cache.prefs, [key]: value };
  persist();
  notify();
}

/* ----------------------- invoice draft ----------------------- */

export function readDraft() {
  return cache.draft;
}

export function writeDraft(draft) {
  cache.draft = draft;
  persist();
  notify();
}

export function clearDraftCache() {
  cache.draft = null;
  persist();
  notify();
}
