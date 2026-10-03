import { createRoot } from 'react-dom/client';
import { AuthProvider, useAuth } from '/src/context/AuthContext.jsx';

const KEY = 'albalqan:last-activity';
const params = new URLSearchParams(location.search);

const seed = params.get('seed');
if (seed === 'stale') {
  localStorage.setItem(KEY, String(Date.now() - 31 * 60 * 1000));
} else if (seed === 'fresh') {
  localStorage.setItem(KEY, String(Date.now()));
} else if (seed === 'none') {
  localStorage.removeItem(KEY);
}

// Start on a non-root hash so an idle logout (which navigates to #/) is visible.
location.hash = '#/history';

const poke = Number(params.get('poke') || 0);
const writer = Number(params.get('writer') || 0);

// poke > 0: simulate a user active in THIS tab.
if (poke > 0) {
  window.setInterval(() => window.dispatchEvent(new Event('pointerdown')), poke);
}

// writer > 0: simulate a user active in ANOTHER tab (shared localStorage).
if (writer > 0) {
  window.setInterval(() => {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch (err) {
      /* ignore */
    }
  }, writer);
}

let authState = { loading: true, session: false };

function Probe() {
  const { session, loading } = useAuth();
  authState = { loading, session: Boolean(session) };
  return null;
}

const rootEl = document.getElementById('root');
if (!rootEl) {
  const div = document.createElement('div');
  div.id = 'root';
  document.body.appendChild(div);
}
createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <Probe />
  </AuthProvider>
);

let last = '';
window.setInterval(() => {
  const state = JSON.stringify({
    t: Date.now(),
    loading: authState.loading,
    session: authState.session,
    activity: localStorage.getItem(KEY),
    hash: location.hash,
  });
  if (state !== last) {
    last = state;
    const el = document.getElementById('probe');
    if (el) el.textContent = state;
  }
}, 100);
