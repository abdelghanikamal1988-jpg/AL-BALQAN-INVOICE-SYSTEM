/**
 * Watches for new consultation requests while the app is open.
 *
 * The requests only reach the database when the Netlify sync runs, so this
 * provider re-runs that sync on a timer for users who opted into browser
 * notifications, then announces whatever arrived. Users who never grant
 * permission cause no background traffic at all.
 *
 * Exposes the number of requests still marked `new` so the sidebar can
 * show a badge, and a `refresh()` for pages that change a status.
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext.jsx';
import { useLang } from './LangContext.jsx';
import { dbCountNewConsultations, syncNetlifyForms } from '../lib/consultationRepo.js';
import {
  notificationPermission,
  requestNotificationPermission,
  showNotification,
} from '../utils/notify.js';

const ConsultationNotifierContext = createContext(null);

/** How often to re-check for new requests, in milliseconds. */
const POLL_MS = 5 * 60 * 1000;

export function ConsultationNotifierProvider({ children }) {
  const { user, hasPerm } = useAuth();
  const { t } = useLang();
  const [newCount, setNewCount] = useState(0);
  const [permission, setPermission] = useState(() => notificationPermission());
  const syncingRef = useRef(false);

  const canRead = Boolean(user) && hasPerm('page:consultations');

  const refresh = useCallback(async () => {
    if (!canRead) {
      setNewCount(0);
      return 0;
    }
    try {
      const count = await dbCountNewConsultations();
      setNewCount(count);
      return count;
    } catch (err) {
      return 0;
    }
  }, [canRead]);

  const enable = useCallback(async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    return result;
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /* Re-read the count when the tab comes back, so returning to the app
     reflects anything that changed while it was in the background. */
  useEffect(() => {
    if (!canRead) return undefined;
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [canRead, refresh]);

  /* Periodic sync — only for users who granted notification permission,
     so nobody pays for background Netlify calls they did not ask for. */
  useEffect(() => {
    if (!canRead || permission !== 'granted') return undefined;

    const tick = async () => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      try {
        const result = await syncNetlifyForms();
        const arrived = Number(result?.synced_new ?? 0);
        const count = await dbCountNewConsultations();
        setNewCount(count);
        if (arrived > 0) {
          showNotification(
            t('consultations.notifyTitle'),
            t('consultations.notifyBody', { n: arrived }),
            'albalqan-consultations'
          );
        }
      } catch (err) {
        /* a failed background sync must never surface an error */
      } finally {
        syncingRef.current = false;
      }
    };

    const id = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(id);
  }, [canRead, permission, t]);

  const value = { newCount, permission, enable, refresh };
  return (
    <ConsultationNotifierContext.Provider value={value}>
      {children}
    </ConsultationNotifierContext.Provider>
  );
}

export function useConsultationNotifier() {
  const ctx = useContext(ConsultationNotifierContext);
  if (!ctx) {
    throw new Error('useConsultationNotifier must be used inside ConsultationNotifierProvider');
  }
  return ctx;
}
