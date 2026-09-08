import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import company from '../../data/company.js';
import { getInvoices } from '../../utils/storage.js';
import { calculatePayment, PAYMENT_STATUS } from '../../utils/paymentCalculator.js';
import { invoicePaymentBreakdown } from '../../utils/vat.js';
import { formatDate } from '../../utils/formatDate.js';
import Modal from '../../components/Modal/Modal.jsx';
import { useToast } from '../../components/Toast/ToastProvider.jsx';
import { importInvoices } from '../../utils/storage.js';

export default function Dashboard() {
  const toast = useToast();
  const [refreshKey, setRefreshKey] = useState(0);
  const fileInputRef = useRef(null);
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    let active = true;
    getInvoices()
      .then((list) => {
        if (active) setInvoices(list);
      })
      .catch(() => {
        if (active) setInvoices([]);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const stats = useMemo(() => {
    const today = formatDate(new Date());
    let total = 0;
    let todayCount = 0;
    let partiallyPaid = 0;

    invoices.forEach((inv) => {
      total += 1;
      if (inv.issueDate === today) todayCount += 1;
      const calc = calculatePayment(invoicePaymentBreakdown(inv.payment).grandTotal, inv.payment?.paid);
      if (calc.status === PAYMENT_STATUS.PARTIALLY_PAID) partiallyPaid += 1;
    });

    return { total, todayCount, partiallyPaid };
  }, [invoices]);

  const handleExport = async () => {
    let invoices;
    try {
      invoices = await getInvoices();
    } catch (err) {
      toast.error('Unable to load invoices for export.');
      return;
    }
    if (invoices.length === 0) {
      toast.info('No invoices to export yet.');
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(invoices, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `albalqan-invoices-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success('Backup exported successfully.');
  };

  const handleImportFile = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      importInvoices(JSON.parse(reader.result))
        .then((added) => {
          if (added === 0) {
            toast.info('No new invoices were added (duplicates skipped).');
          } else {
            toast.success(`${added} invoice${added > 1 ? 's' : ''} imported.`);
            setRefreshKey((k) => k + 1);
          }
        })
        .catch(() => {
          toast.error('Import failed. The file is not a valid AL BALQAN backup.');
        });
    };
    reader.onerror = () => {
      toast.error('Import failed. Could not read the file.');
    };
    reader.readAsText(file);
  };

  return (
    <div className="page">
      <section className="dashboard-hero">
        <div>
          <h1>Create professional invoices for {company.shortName}</h1>
          <p>
            Generate a temporary invoice in seconds — automatically numbered with your payment
            calculation, ready to print or export as PDF.
          </p>
        </div>
        <div className="dashboard-hero__action">
          <Link to="/create" className="btn btn--primary">
            + Create New Invoice
          </Link>
        </div>
      </section>

      <div className="stat-grid" aria-label="Invoice statistics">
        <div className="card stat-card">
          <div className="stat-card__label">Total Invoices</div>
          <div className="stat-card__value">{stats.total}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-card__label">Today's Invoices</div>
          <div className="stat-card__value">{stats.todayCount}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-card__label">Partially Paid</div>
          <div className="stat-card__value">{stats.partiallyPaid}</div>
        </div>
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 12 }}>Quick Actions</h2>
      <div className="quick-actions">
        <Link to="/create" className="quick-action">
          <div className="quick-action__icon" aria-hidden="true">🧾</div>
          <h3>New Invoice</h3>
          <p>Create a new temporary invoice.</p>
        </Link>
        <Link to="/history" className="quick-action">
          <div className="quick-action__icon" aria-hidden="true">📁</div>
          <h3>Invoice History</h3>
          <p>Search, view, edit, print or export saved invoices.</p>
        </Link>
      </div>

      <div className="storage-note">
        <strong>Backup your data:</strong> Invoices are stored securely in the cloud. Use
        Export Data to create a JSON backup.
      </div>

      <div style={{ marginTop: 14 }} className="editor-actions">
        <button type="button" className="btn btn--secondary" onClick={handleExport}>
          Export Data
        </button>
        <button type="button" className="btn btn--secondary" onClick={() => fileInputRef.current?.click()}>
          Import Data
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImportFile(file);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
