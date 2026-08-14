import { HashRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header/Header.jsx';
import { ToastProvider } from './components/Toast/ToastProvider.jsx';
import Dashboard from './pages/Dashboard/Dashboard.jsx';
import CreateInvoice from './pages/CreateInvoice/CreateInvoice.jsx';
import InvoiceHistory from './pages/InvoiceHistory/InvoiceHistory.jsx';

export default function App() {
  return (
    <ToastProvider>
      <HashRouter>
        <div className="app-shell">
          <Header />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/create" element={<CreateInvoice />} />
            <Route path="/edit/:id" element={<CreateInvoice />} />
            <Route path="/history" element={<InvoiceHistory />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </div>
      </HashRouter>
    </ToastProvider>
  );
}
