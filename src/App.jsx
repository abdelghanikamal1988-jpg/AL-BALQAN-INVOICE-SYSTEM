import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header/Header.jsx';
import { ToastProvider } from './components/Toast/ToastProvider.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Dashboard from './pages/Dashboard/Dashboard.jsx';
import CreateInvoice from './pages/CreateInvoice/CreateInvoice.jsx';
import InvoiceHistory from './pages/InvoiceHistory/InvoiceHistory.jsx';
import Login from './pages/Login/Login.jsx';

function Shell() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="login-page">
        <div className="card login-card login-card--loading">
          <span className="spinner" aria-hidden="true" />
          <p>Loading…</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <div className="app-shell">
      <Header />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/create" element={<CreateInvoice />} />
        <Route path="/edit/:id" element={<CreateInvoice />} />
        <Route path="/history" element={<InvoiceHistory />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <HashRouter>
          <Shell />
        </HashRouter>
      </AuthProvider>
    </ToastProvider>
  );
}