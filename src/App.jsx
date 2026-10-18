import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header/Header.jsx';
import Sidebar from './components/Sidebar/Sidebar.jsx';
import Icon from './components/Icons/Icon.jsx';
import { ToastProvider } from './components/Toast/ToastProvider.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ConsultationNotifierProvider } from './context/ConsultationNotifier.jsx';
import { PendingApprovalsProvider } from './context/PendingApprovalsContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { LangProvider, useLang } from './context/LangContext.jsx';
import { readPref, writePref, subscribeUserData } from './lib/userData.js';
import Dashboard from './pages/Dashboard/Dashboard.jsx';
import CreateInvoice from './pages/CreateInvoice/CreateInvoice.jsx';
import InvoiceHistory from './pages/InvoiceHistory/InvoiceHistory.jsx';
import Clients from './pages/Clients/Clients.jsx';
import ClientForm from './pages/ClientForm/ClientForm.jsx';
import ClientDetail from './pages/ClientDetail/ClientDetail.jsx';
import AdminUsers from './pages/AdminUsers/AdminUsers.jsx';
import Consultations from './pages/Consultations/Consultations.jsx';
import AuditLog from './pages/AuditLog/AuditLog.jsx';
import Settings from './pages/Settings/Settings.jsx';
import Login from './pages/Login/Login.jsx';
import Website from './pages/Website/Website.jsx';

/**
 * Every route declares the permission that unlocks it.
 * Shell filters this list with hasPerm() before rendering.
 */
const ROUTES = [
  { path: '/', perm: 'page:dashboard', element: <Dashboard /> },
  { path: '/create', perm: 'page:invoice.create', element: <CreateInvoice /> },
  { path: '/edit/:id', perm: 'action:invoice.save', element: <CreateInvoice /> },
  { path: '/history', perm: 'page:invoice.history', element: <InvoiceHistory /> },
  { path: '/clients', perm: 'page:clients', element: <Clients /> },
  { path: '/clients/new', perm: 'page:clients.new', element: <ClientForm /> },
  { path: '/clients/:id/edit', perm: 'action:client.save', element: <ClientForm /> },
  { path: '/clients/:id', perm: 'page:clients', element: <ClientDetail /> },
  { path: '/admin/users', perm: 'page:admin', element: <AdminUsers /> },
  { path: '/consultations', perm: 'page:consultations', element: <Consultations /> },
  { path: '/audit', perm: 'page:admin', element: <AuditLog /> },
  { path: '/settings', perm: 'page:settings', element: <Settings /> },
];

function NoAccess({ onSignOut }) {
  const { t } = useLang();
  return (
    <div className="login-page">
      <div className="card login-card">
        <span className="card__icon" aria-hidden="true"><Icon name="lock" /></span>
        <h1>{t('shell.noAccessTitle')}</h1>
        <p className="login-card__note">{t('shell.noAccessBody')}</p>
        <button type="button" className="btn btn--primary" onClick={onSignOut}>
          {t('shell.signOut')}
        </button>
      </div>
    </div>
  );
}

function Shell() {
  const { session, loading, hasPerm, signOut } = useAuth();
  const { t } = useLang();
  const [navOpen, setNavOpen] = useState(() => {
    if (window.innerWidth >= 1024) {
      return !readPref('sidebarCollapsed');
    }
    return false;
  });

  /* Re-read the stored preference once per-user data is hydrated, because
     the initial state above is computed before the database load finishes. */
  useEffect(
    () =>
      subscribeUserData(() => {
        if (window.innerWidth >= 1024) {
          setNavOpen(!readPref('sidebarCollapsed'));
        }
      }),
    [],
  );

  const toggleNav = () => {
    setNavOpen((o) => {
      const next = !o;
      if (window.innerWidth >= 1024) {
        writePref('sidebarCollapsed', !next);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="login-page">
        <div className="card login-card login-card--loading">
          <span className="spinner" aria-hidden="true" />
          <p>{t('shell.loading')}</p>
        </div>
      </div>
    );
  }

  if (!session) {
    /* The login gate is intentionally isolated: always English, always LTR. */
    return (
      <div dir="ltr" lang="en">
        <Login />
      </div>
    );
  }

  const allowed = ROUTES.filter((route) => hasPerm(route.perm));
  const allowedPages = allowed.filter((route) => route.perm.startsWith('page:'));
  const homeTarget = allowedPages[0]?.path ?? '/';

  if (allowedPages.length === 0) {
    return <NoAccess onSignOut={signOut} />;
  }

  return (
    <PendingApprovalsProvider>
      <div className="app-shell">
        <div className="app-shell__body">
          <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
          <div className="app-shell__main">
            <Header menuOpen={navOpen} onMenuToggle={toggleNav} />
            <Routes>
              {allowed.map((route) => (
                <Route key={route.path} path={route.path} element={route.element} />
              ))}
              <Route path="*" element={<Navigate to={homeTarget} replace />} />
            </Routes>
          </div>
        </div>
      </div>
    </PendingApprovalsProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LangProvider>
        <ToastProvider>
          <AuthProvider>
            <ConsultationNotifierProvider>
              <HashRouter>
                <Routes>
                  <Route path="/website" element={<Website />} />
                  <Route path="/*" element={<Shell />} />
                </Routes>
              </HashRouter>
            </ConsultationNotifierProvider>
          </AuthProvider>
        </ToastProvider>
      </LangProvider>
    </ThemeProvider>
  );
}
