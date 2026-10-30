import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';
import { recordAccess } from '../utils/accessLog.js';
import { hydrateUserData, resetUserDataCache } from '../lib/userData.js';

const AuthContext = createContext(null);

/** Last interaction for this tab — kept in memory only, never in storage. */
let lastActivityAt = 0;

const IDLE_EVENTS = [
  'pointerdown',
  'keydown',
  'wheel',
  'touchstart',
  'input',
  'hashchange',
  'popstate',
];

/**
 * 30 minutes of inactivity → silent logout (no warning, no countdown).
 * Dev only: ?idleMs=60000 on the URL shortens the timeout for testing —
 * stripped from production builds.
 */
function resolveIdleTimeout() {
  if (!import.meta.env.DEV) return 30 * 60 * 1000;
  const override = Number(new URLSearchParams(window.location.search).get('idleMs'));
  return Number.isFinite(override) && override > 0 ? override : 30 * 60 * 1000;
}

const IDLE_TIMEOUT_MS = resolveIdleTimeout();

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [configured] = useState(isSupabaseConfigured);

  /**
   * True while the session came from a password-recovery link: the app must
   * send the user to the "set a new password" screen instead of the dashboard.
   */
  const [recovery, setRecovery] = useState(false);

  /* Latest session for event handlers that live outside React render. */
  const sessionRef = useRef(null);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  /**
   * The user's row in public.profiles (role + permissions).
   * profileState:
   *   'loading'     — fetching
   *   'ready'       — fetched (profile may still be null = no row)
   *   'unavailable' — the profiles table does not exist yet
   *                   (admin.sql not run) → legacy full access
   */
  const [profile, setProfile] = useState(null);
  const [profileState, setProfileState] = useState('loading');

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      sub?.subscription.unsubscribe();
    };
  }, [configured]);

  /* ---------- per-user application state (settings / prefs / draft) ---------- */
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!configured || !userId) {
      resetUserDataCache();
      setDataLoading(false);
      return undefined;
    }
    let active = true;
    setDataLoading(true);
    hydrateUserData().finally(() => {
      if (active) setDataLoading(false);
    });
    return () => {
      active = false;
    };
  }, [configured, session?.user?.id]);

  /* ---------- profile (role + permissions) ---------- */
  useEffect(() => {
    const userId = session?.user?.id;
    if (!configured || !userId) {
      setProfile(null);
      setProfileState('ready');
      return undefined;
    }
    let active = true;
    setProfile(null);
    setProfileState('loading');

    supabase
      .from('profiles')
      .select('id, email, full_name, role, permissions, is_active, created_at')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          // admin.sql has not been run yet → keep the old behaviour
          // (every signed-in user has full access) instead of locking out.
          console.warn('[auth] profiles unavailable:', error.message);
          setProfile(null);
          setProfileState('unavailable');
          return;
        }
        setProfile(data ?? null);
        setProfileState('ready');
        if (data && data.is_active === false) {
          // account was deactivated → force logout
          recordAccess({
            action: 'ACCOUNT DISABLED',
            account: sessionRef.current?.user?.email || '',
            details: 'Account deactivated — forced sign-out',
          });
          setSession(null);
          supabase.auth.signOut().catch(() => {});
        }
      });

    return () => {
      active = false;
    };
  }, [configured, session?.user?.id]);

  /**
   * Session-wide idle timeout: 30 minutes without any interaction logs the
   * user out silently and returns to the login screen. Any click, key press,
   * scroll or navigation restarts the timer, so an active user stays signed
   * in indefinitely.
   *
   * The timestamp lives in memory only — nothing about the session is kept
   * in browser storage. A full reload therefore restarts the countdown;
   * each tab tracks its own activity and an idle tab signs the whole
   * session out when its timer fires.
   */
  useEffect(() => {
    if (!configured || loading) return undefined;

    let timer = null;
    let lastActivity = lastActivityAt || Date.now();
    let loggingOut = false;
    let ignoreSelfNav = false;

    const dropLocalTokens = () => {
      try {
        Object.keys(window.localStorage)
          .filter((key) => key.startsWith('sb-') && key.endsWith('-auth-token'))
          .forEach((key) => window.localStorage.removeItem(key));
      } catch (err) {
        /* ignore */
      }
    };

    async function doLogout() {
      if (loggingOut) return;

      loggingOut = true;
      try {
        if (timer) window.clearTimeout(timer);
        timer = null;
        lastActivityAt = 0;
        setSession(null);
        try {
          await Promise.race([
            supabase.auth.signOut(),
            new Promise((resolve) => window.setTimeout(resolve, 4000)),
          ]);
        } catch (err) {
          /* the local session is cleared regardless */
        }
        dropLocalTokens();
        recordAccess({
          action: 'IDLE LOGOUT',
          account: sessionRef.current?.user?.email || '',
          details: 'Auto sign-out after 30 minutes of inactivity',
        });
        const hash = window.location.hash;
        if (hash && hash !== '#/' && hash !== '#/website') {
          // Our own navigation must not count as user activity.
          ignoreSelfNav = true;
          window.location.hash = '#/';
          window.setTimeout(() => {
            ignoreSelfNav = false;
          }, 0);
        }
      } finally {
        loggingOut = false;
      }
    }

    const onActivity = (event) => {
      if (ignoreSelfNav && (event.type === 'hashchange' || event.type === 'popstate')) {
        return;
      }
      lastActivity = Date.now();
      lastActivityAt = lastActivity;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(doLogout, IDLE_TIMEOUT_MS);
    };

    const onRevisit = () => {
      if (Date.now() - lastActivity >= IDLE_TIMEOUT_MS) {
        void doLogout();
      } else {
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(doLogout, IDLE_TIMEOUT_MS - (Date.now() - lastActivity));
      }
    };

    IDLE_EVENTS.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));
    window.addEventListener('focus', onRevisit);
    window.addEventListener('pageshow', onRevisit);
    document.addEventListener('visibilitychange', onRevisit);
    timer = window.setTimeout(doLogout, IDLE_TIMEOUT_MS);

    return () => {
      if (timer) window.clearTimeout(timer);
      timer = null;
      IDLE_EVENTS.forEach((evt) => window.removeEventListener(evt, onActivity));
      window.removeEventListener('focus', onRevisit);
      window.removeEventListener('pageshow', onRevisit);
      document.removeEventListener('visibilitychange', onRevisit);
    };
  }, [configured, loading]);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      recordAccess({
        action: 'FAILED LOGIN',
        account: email,
        details: 'Sign-in failed — wrong email or password',
      });
    } else {
      recordAccess({ action: 'LOGIN', account: email, details: 'Password sign-in' });
    }
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    const account = sessionRef.current?.user?.email || '';
    try {
      await supabase.auth.signOut();
    } finally {
      recordAccess({ action: 'LOGOUT', account, details: 'Signed out' });
    }
  }, []);

  const clearRecovery = useCallback(() => setRecovery(false), []);

  /**
   * Visibility check for a "page:*" / "action:*" permission.
   * - admin role → always true (wildcard)
   * - profiles table missing (legacy mode) → true for everything
   *   except the admin panel (its RPCs wouldn't exist either)
   * - otherwise → must be listed in profiles.permissions
   */
  const hasPerm = useCallback(
    (perm) => {
      if (!perm) return true;
      if (profileState === 'unavailable') return perm !== 'page:admin';
      if (!profile || profile.is_active === false) return false;
      if (perm === 'page:admin') return profile.role === 'admin';
      if (profile.role === 'admin') return true;
      return Array.isArray(profile.permissions) && profile.permissions.includes(perm);
    },
    [profile, profileState],
  );

  const isAdmin = profile?.role === 'admin' && profile.is_active !== false;
  const profileLoading = Boolean(session) && profileState === 'loading';

  /**
   * True for signed-in non-admins when the roles system is live: their
   * EDITS to invoices/clients are submitted for admin approval instead of
   * being applied immediately. Admins (and legacy mode without admin.sql)
   * keep the old direct behaviour.
   */
  const needsEditApproval = profileState !== 'unavailable' && !isAdmin;

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        profileState,
        hasPerm,
        isAdmin,
        needsEditApproval,
        loading: loading || profileLoading || dataLoading,
        configured,
        signIn,
        signOut,
        recovery,
        clearRecovery,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}