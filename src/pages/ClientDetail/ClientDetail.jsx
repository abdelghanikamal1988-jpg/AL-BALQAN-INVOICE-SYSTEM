import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Modal from '../../components/Modal/Modal.jsx';
import ConfirmAuthModal from '../../components/ConfirmAuth/ConfirmAuthModal.jsx';
import Icon from '../../components/Icons/Icon.jsx';
import Can from '../../components/Can/Can.jsx';
import { useToast } from '../../components/Toast/ToastProvider.jsx';
import { dbFetchClient, dbUpdateClient, dbDeleteClient } from '../../lib/clientRepo.js';
import {
  clientFullName,
  getClientInvoices,
} from '../../utils/clients.js';
import {
  DOCUMENT_TYPES,
  documentUrl,
  pdfUrl,
  removeClientFiles,
} from '../../utils/uploads.js';
import {
  buildClientPdf,
  downloadBytes,
  clientPdfFilename,
  generateAndStoreClientPdf,
} from '../../utils/clientPdf.js';
import { CLIENT_STATUSES, statusClass } from '../../data/clientStatuses.js';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { serviceLabel } from '../../utils/labels.js';
import '../../styles/clients.css';

function fmtDate(iso) {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

const DETAIL_FIELDS = [
  ['Name', 'firstName'],
  ['Father Name', 'fatherName'],
  ['Surname', 'surname'],
  ['Country Name', 'country'],
  ['Passport No.', 'passport'],
  ['Sex', 'sex'],
  ['Date of Birth', 'dateOfBirth', true],
  ['Place of Birth', 'placeOfBirth'],
  ['Date of Issue', 'dateOfIssue', true],
  ['Date of Expiry', 'dateOfExpiry', true],
  ['Issuing Place', 'issuingPlace'],
  ['Referral Agent', 'referralAgent'],
];

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [docUrls, setDocUrls] = useState({});
  const [busyPdf, setBusyPdf] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [authPrompt, setAuthPrompt] = useState(false);

  const load = async () => {
    try {
      const record = await dbFetchClient(id);
      if (!record) {
        toast.error('Client not found.');
        navigate('/clients', { replace: true });
        return;
      }
      setClient(record);
      const rows = await getClientInvoices(record.passport);
      setInvoices(rows);
      const urls = {};
      for (const def of DOCUMENT_TYPES) {
        const meta = record.documents?.[def.id];
        if (meta && meta.path) {
          try {
            urls[def.id] = await documentUrl(meta.path);
          } catch (err) {
            urls[def.id] = null;
          }
        }
      }
      setDocUrls(urls);
    } catch (err) {
      console.error(err);
      toast.error('Unable to load the client.');
      navigate('/clients', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleStatus = async (status) => {
    try {
      const updated = { ...client, status, updatedAt: new Date().toISOString() };
      const saved = await dbUpdateClient(updated);
      setClient(saved || updated);
      toast.success(`Status set to ${status}.`);
    } catch (err) {
      toast.error('Unable to update the status.');
    }
  };

  const handleGeneratePdf = async () => {
    setBusyPdf(true);
    try {
      const { bytes, path } = await generateAndStoreClientPdf(client);
      setClient((prev) => ({ ...prev, pdfPath: path }));
      downloadBytes(bytes, clientPdfFilename(client));
      toast.success('PDF generated, stored and downloaded.');
    } catch (err) {
      console.error(err);
      toast.error('Unable to generate the PDF. Please try again.');
    } finally {
      setBusyPdf(false);
    }
  };

  const handleDownloadStored = async () => {
    try {
      const url = await pdfUrl(client.pdfPath);
      if (!url) throw new Error('missing');
      const res = await fetch(url);
      const bytes = await res.arrayBuffer();
      downloadBytes(bytes, clientPdfFilename(client));
    } catch (err) {
      toast.error('Unable to download the stored PDF.');
    }
  };

  /** Runs after the password gate — any failure is shown inside that modal. */
  const performDelete = async () => {
    await dbDeleteClient(client.id);
    try {
      await removeClientFiles(client.id);
    } catch (err) {
      console.warn('Uploaded files could not be removed', err);
    }
    toast.info('Client deleted.');
  };

  if (loading || !client) {
    return (
      <div className="page page--wide clients-page">
        <div className="card">
          <div className="loading-row">
            <span className="spinner" aria-hidden="true" />
            Loading client…
          </div>
        </div>
      </div>
    );
  }

  const photoUrl = docUrls.photo;
  const totalInvoice = invoices.reduce((sum, r) => sum + (r.payment?.grandTotal || 0), 0);
  const totalPaid = invoices.reduce((sum, r) => sum + (Number(r.calc?.paid) || 0), 0);
  const totalRemaining = invoices.reduce((sum, r) => sum + (Number(r.calc?.remaining) || 0), 0);

  return (
    <div className="page page--wide clients-page">
      <div className="page-header">
        <div>
          <h1>{clientFullName(client) || 'Client'}</h1>
          <p className="subtitle">
            Passport <span className="mono">{client.passport || '—'}</span> · {client.country || '—'} · Agent{' '}
            {client.referralAgent || '—'}
          </p>
        </div>
        <div className="editor-actions">
          <Link to="/clients" className="btn btn--neutral">
            Back to Clients
          </Link>
          <Can perm="action:client.save">
            <Link to={`/clients/${client.id}/edit`} className="btn btn--secondary">
              Edit
            </Link>
          </Can>
          <Can perm="action:client.delete">
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </button>
          </Can>
        </div>
      </div>

      <section className="card cd-profile">
        <div className="cd-profile__info">
          <span className="cd-eyebrow">Client Application</span>
          <div className="cd-profile__chips">
            <span className="cl-passport">{client.passport || '—'}</span>
            <span className="cd-chip">{client.country || '—'}</span>
            <span className="cd-chip">Agent · {client.referralAgent || '—'}</span>
          </div>
          <div className="cd-profile__status">
            <span className={`cbadge ${statusClass(client.status)}`}>
              {client.status || 'NEW'}
            </span>
            <Can perm="action:client.status">
              <div className="field cd-profile__select">
                <label htmlFor="client-status">Application status</label>
                <select
                  id="client-status"
                  value={client.status || 'NEW'}
                  onChange={(e) => handleStatus(e.target.value)}
                >
                  {CLIENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </Can>
          </div>
          <div className="cd-profile__actions">
            <Can perm="action:client.pdf">
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleGeneratePdf}
                disabled={busyPdf}
              >
                {busyPdf ? <span className="btn__spinner" aria-hidden="true" /> : 'Generate PDF'}
              </button>
            </Can>
            <Can perm="action:client.pdf">
              {client.pdfPath && (
                <button type="button" className="btn btn--secondary" onClick={handleDownloadStored}>
                  Download Stored PDF
                </button>
              )}
            </Can>
          </div>
          <p className="cd-profile__note">
            The company letterhead is used exactly as provided — only the client information and
            images are placed on it.
            {client.pdfPath ? ' The last document is stored in Supabase Storage.' : ''}
          </p>
        </div>
        <div className="cd-profile__photo">
          {photoUrl ? (
            <img className="cd-photo" src={photoUrl} alt="Client" />
          ) : (
            <div className="cd-photo cd-photo--empty">No photo</div>
          )}
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="card__header">
          <span className="card__icon" aria-hidden="true"><Icon name="user" /></span>
          <h2>Client Record</h2>
        </div>
        <div className="card__body">
          <div className="cd-grid">
            {DETAIL_FIELDS.map(([label, key, isDate]) => (
              <div className="cd-item" key={key}>
                <div className="cd-item__label">{label}</div>
                <div className="cd-item__value cd-item__value--caps">
                  {isDate ? fmtDate(client[key]) : client[key] || '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="card__header">
          <span className="card__icon" aria-hidden="true"><Icon name="paperclip" /></span>
          <h2>Documents</h2>
        </div>
        <div className="card__body">
          <div className="cd-docs">
            {DOCUMENT_TYPES.map((def) => {
              const meta = client.documents?.[def.id];
              const url = docUrls[def.id];
              return (
                <div className="cd-doc" key={def.id}>
                  {url ? (
                    meta?.type === 'application/pdf' ? (
                      <div className="cd-doc__media cd-doc__media--missing">PDF document</div>
                    ) : (
                      <img className="cd-doc__media" src={url} alt={def.label} />
                    )
                  ) : (
                    <div className="cd-doc__media cd-doc__media--missing">Not uploaded</div>
                  )}
                  <div className="cd-doc__body">
                    <strong>{def.label}</strong>
                    <span className="cd-doc__name">{meta?.name || '—'}</span>
                    <div className="cl-actions">
                      {url && (
                        <a
                          className="btn btn--secondary btn--sm"
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open
                        </a>
                      )}
                      <Can perm="action:client.upload">
                        <Link
                          className="btn btn--neutral btn--sm"
                          to={`/clients/${client.id}/edit`}
                        >
                          {meta ? 'Replace' : 'Upload'}
                        </Link>
                      </Can>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="card__header">
          <span className="card__icon" aria-hidden="true"><Icon name="receipt" /></span>
          <h2>Linked Invoices</h2>
        </div>
        <div className="card__body">
          {invoices.length === 0 ? (
            <div className="cd-empty">
              No invoice has been created for this client yet.
              <br />
              Create one in the <Link to="/create">Invoice System</Link> using passport number{' '}
              <strong>{client.passport || '—'}</strong> and it will appear here automatically.
            </div>
          ) : (
            <>
              <div className="cl-table-wrap">
                <table className="cl-table">
                  <thead>
                    <tr>
                      <th>Invoice No.</th>
                      <th>Date</th>
                      <th>Service</th>
                      <th>Total</th>
                      <th>Paid</th>
                      <th>Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((row) => (
                      <tr key={row.invoice.id}>
                        <td className="mono">{row.invoice.invoiceNumber}</td>
                        <td>{row.invoice.issueDate || '—'}</td>
                        <td>{serviceLabel(row.invoice.travel?.service) || '—'}</td>
                        <td>{formatCurrency(row.payment.grandTotal)}</td>
                        <td>{formatCurrency(row.calc.paid)}</td>
                        <td>{formatCurrency(row.calc.remaining)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="cd-totals">
                <span className="cd-total">
                  Total <b>{formatCurrency(totalInvoice)}</b>
                </span>
                <span className="cd-total cd-total--paid">
                  Paid <b>{formatCurrency(totalPaid)}</b>
                </span>
                <span className="cd-total cd-total--remaining">
                  Remaining <b>{formatCurrency(totalRemaining)}</b>
                </span>
              </div>
            </>
          )}
        </div>
      </section>

      <p className="history-note">
        Invoice amounts are read live from the Invoice System — this module never stores payment
        data.
      </p>

      {confirmDelete && !authPrompt && (
        <Modal
          title="Delete client?"
          danger
          onClose={() => setConfirmDelete(false)}
          actions={
            <>
              <button
                type="button"
                className="btn btn--neutral"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </button>
              <button type="button" className="btn btn--danger" onClick={() => setAuthPrompt(true)}>
                Delete Client
              </button>
            </>
          }
        >
          <p>
            This permanently removes <strong>{clientFullName(client)}</strong>, the uploaded
            documents and the stored PDF. Invoice records are not affected.
          </p>
        </Modal>
      )}

      {confirmDelete && authPrompt && (
        <ConfirmAuthModal
          title="Confirm your identity"
          reason={`Enter your account credentials to permanently delete ${clientFullName(
            client
          )} and their documents.`}
          onCancel={() => setAuthPrompt(false)}
          onConfirm={performDelete}
          onSuccess={() => {
            setConfirmDelete(false);
            setAuthPrompt(false);
            navigate('/clients');
          }}
        />
      )}
    </div>
  );
}
