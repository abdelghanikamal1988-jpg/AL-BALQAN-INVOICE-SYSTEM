import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import InvoiceHistoryToolbar from '../../components/InvoiceHistory/InvoiceHistoryToolbar.jsx';
import InvoicePreview from '../../components/InvoicePreview/InvoicePreview.jsx';
import Modal from '../../components/Modal/Modal.jsx';
import { useToast } from '../../components/Toast/ToastProvider.jsx';
import {
  getInvoices,
  deleteInvoice,
  searchInvoices,
  importInvoices,
} from '../../utils/storage.js';
import { calculatePayment, statusLabel, statusClass } from '../../utils/paymentCalculator.js';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { formatDateShort } from '../../utils/formatDate.js';
import { serviceLabel, destinationLabel } from '../../utils/labels.js';
import { exportInvoicePdf, printInvoicePdf } from '../../utils/pdf.js';
import { invoicePaymentBreakdown } from '../../utils/vat.js';

function toPreviewForm(inv) {
  return {
    name: inv.customer?.name || '',
    nationality: inv.customer?.nationality || '',
    passport: inv.customer?.passport || '',
    phone: inv.customer?.phone || '',
    email: inv.customer?.email || '',
    destination: inv.travel?.destination || '',
    service: inv.travel?.service || '',
    residenceType: inv.travel?.residenceType || '',
    total: inv.payment?.total ?? '',
    paid: inv.payment?.paid ?? '',
    vatMode: inv.payment?.vatMode || 'none',
    notes: inv.notes || '',
    issueDateDisplay: inv.issueDate || '',
    issueTimeDisplay: inv.issueTime || '',
  };
}

export default function InvoiceHistory() {
  const navigate = useNavigate();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [deletePrompt, setDeletePrompt] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    searchInvoices(query)
      .then((list) => {
        if (active) setInvoices(list);
      })
      .catch(() => {
        if (active) setInvoices([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query, refreshKey]);

  const handleExport = async () => {
    let all;
    try {
      all = await getInvoices();
    } catch (err) {
      toast.error('Unable to load invoices for export.');
      return;
    }
    if (all.length === 0) {
      toast.info('No invoices to export yet.');
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
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

  const confirmDelete = async () => {
    if (!deletePrompt) return;
    try {
      await deleteInvoice(deletePrompt.id);
      setDeletePrompt(null);
      setRefreshKey((k) => k + 1);
      toast.info('Invoice deleted.');
    } catch (err) {
      toast.error('Unable to delete the invoice. Please try again.');
    }
  };

  /* ---------- Print / PDF actions ---------- */
  const handlePdf = (invoice) => {
    exportInvoicePdf(invoice)
      .then(() => toast.success('PDF exported successfully.'))
      .catch(() => toast.error('Unable to export PDF. Please try again or use Print.'));
  };

  const handlePrint = (invoice) => {
    printInvoicePdf(invoice)
      .then(() => {})
      .catch(() => toast.error("Unable to open the print dialog. Please use your browser's print command."));
  };

  return (
    <div className="page page--wide">
      <div className="page-header">
        <div>
          <h1>Invoice History</h1>
          <p className="subtitle">Search, view, edit, print or export saved invoices.</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => navigate('/create')}>
          + New Invoice
        </button>
      </div>

      <InvoiceHistoryToolbar
        query={query}
        onChange={setQuery}
        onExport={handleExport}
        onImport={() => fileInputRef.current?.click()}
        onClear={query ? () => setQuery('') : null}
      />

      {loading ? (
        <div className="card">
          <div className="loading-row">
            <span className="spinner" aria-hidden="true" />
            Loading invoices…
          </div>
        </div>
      ) : invoices.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state__icon" aria-hidden="true">🧾</div>
            <h3>No invoices yet</h3>
            <p>Create your first invoice to see it here.</p>
            <button type="button" className="btn btn--primary" onClick={() => navigate('/create')}>
              Create Invoice
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="history-table-wrap">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Invoice No.</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Passport</th>
                  <th>Destination</th>
                  <th>Service</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Remaining</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const payment = invoicePaymentBreakdown(inv.payment);
                  const calc = calculatePayment(payment.grandTotal, payment.paid);
                  return (
                    <tr key={inv.id}>
                      <td className="mono">{inv.invoiceNumber}</td>
                      <td>{inv.issueDate || '—'}</td>
                      <td>{inv.customer?.name || '—'}</td>
                      <td>{inv.customer?.passport || '—'}</td>
                      <td>{destinationLabel(inv.travel?.destination)}</td>
                      <td>{serviceLabel(inv.travel?.service)}</td>
                      <td>{formatCurrency(calc.total)}</td>
                      <td>{formatCurrency(calc.paid)}</td>
                      <td>{formatCurrency(calc.remaining)}</td>
                      <td>
                        <span className={`badge ${statusClass(calc.status)}`}>
                          {statusLabel(calc.status)}
                        </span>
                      </td>
                      <td className="actions-cell">
                        <button
                          type="button"
                          className="btn btn--neutral btn--sm"
                          onClick={() => setViewInvoice(inv)}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="btn btn--secondary btn--sm"
                          onClick={() => navigate(`/edit/${inv.id}`)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn--secondary btn--sm"
                          onClick={() => handlePrint(inv)}
                        >
                          Print
                        </button>
                        <button
                          type="button"
                          className="btn btn--secondary btn--sm"
                          onClick={() => handlePdf(inv)}
                        >
                          PDF
                        </button>
                        <button
                          type="button"
                          className="btn btn--danger btn--sm"
                          aria-label={`Delete invoice ${inv.invoiceNumber}`}
                          onClick={() => setDeletePrompt(inv)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="history-note">
        Invoices are stored securely in the cloud. Export Data regularly to keep a JSON backup.
      </div>

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

      {/* View modal */}
      {viewInvoice && (
        <Modal
          title={`Invoice ${viewInvoice.invoiceNumber} · ${formatDateShort(viewInvoice.issueDate)}`}
          onClose={() => setViewInvoice(null)}
          actions={
            <>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => handlePdf(viewInvoice)}
              >
                Export PDF
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  setViewInvoice(null);
                  handlePrint(viewInvoice);
                }}
              >
                Print
              </button>
            </>
          }
        >
          <div className="invoice-sheet-wrap" style={{ maxHeight: '70vh' }}>
            <InvoicePreview
              form={toPreviewForm(viewInvoice)}
              invoiceNumber={viewInvoice.invoiceNumber}
            />
          </div>
        </Modal>
      )}

      {/* Delete confirmation */}
      {deletePrompt && (
        <Modal
          title="Delete invoice?"
          danger
          onClose={() => setDeletePrompt(null)}
          actions={
            <>
              <button type="button" className="btn btn--neutral" onClick={() => setDeletePrompt(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn--danger" onClick={confirmDelete}>
                Delete
              </button>
            </>
          }
        >
          <p>
            This will permanently remove invoice {deletePrompt.invoiceNumber} from your
            account. This action cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}
