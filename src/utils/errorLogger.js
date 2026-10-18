/**
 * Lightweight client-side error reporting.
 *
 * Every caught error is written to the `error_logs` table so an admin can
 * see what broke without needing a third-party service. The write is
 * fire-and-forget: a network failure here must never mask the original
 * error the user is already seeing.
 */

import { supabase } from '../lib/supabase.js';

const MAX_QUEUE = 20;
const queue = [];
let flushing = false;

function currentPath() {
  try {
    return window.location.hash.replace(/^#/, '') || '/';
  } catch {
    return '/';
  }
}

async function flush() {
  if (flushing || !queue.length || !supabase) return;
  flushing = true;
  const batch = queue.splice(0, MAX_QUEUE);
  try {
    await supabase.from('error_logs').insert(batch);
  } catch {
    /* never throw from the reporter */
  } finally {
    flushing = false;
    if (queue.length) flush();
  }
}

/**
 * Records one error. Safe to call from anywhere — including an error
 * boundary — because it never throws and never returns a promise the
 * caller has to await.
 */
export function reportError(error, { component = '' } = {}) {
  const err = error instanceof Error ? error : new Error(String(error));
  let userId = null;
  supabase?.auth
    ?.getSession()
    .then(({ data }) => {
      userId = data?.session?.user?.id ?? null;
      queue.push({
        user_id: userId,
        message: (err.message || 'Unknown error').slice(0, 1000),
        stack: (err.stack || '').slice(0, 4000),
        component: component.slice(0, 120),
        page: currentPath().slice(0, 200),
        user_agent: (typeof navigator !== 'undefined' ? navigator.userAgent : '').slice(0, 300),
      });
      if (queue.length >= MAX_QUEUE) flush();
    })
    .catch(() => {
      queue.push({
        message: (err.message || 'Unknown error').slice(0, 1000),
        stack: (err.stack || '').slice(0, 4000),
        component: component.slice(0, 120),
        page: currentPath().slice(0, 200),
      });
    });

  /* Also log to the console so a developer with devtools open still sees it. */
  console.error(`[AL BALQAN]${component ? ` (${component})` : ''}`, err);
}

/** Sends anything still queued when the tab goes away. */
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}
