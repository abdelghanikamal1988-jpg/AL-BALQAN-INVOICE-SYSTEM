import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Modal from '../../components/Modal/Modal.jsx';
import ConfirmAuthModal from '../../components/ConfirmAuth/ConfirmAuthModal.jsx';
import Icon from '../../components/Icons/Icon.jsx';
import Can from '../../components/Can/Can.jsx';
import { useToast } from '../../components/Toast/ToastProvider.jsx';
import { useLang } from '../../context/LangContext.jsx';
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
  ['clients.field.name', 'firstName'],
  ['clients.field.fatherName', 'fatherName'],
  ['clients.field.surname', 'surname'],
  ['clients.field.country', 'country'],
  ['clients.field.passport', 'passport'],
  ['clients.field.sex', 'sex'],
  ['clients.field.dateOfBirth', 'dateOfBirth', true],
  ['clients.field.placeOfBirth', 'placeOfBirth'],
  ['clients.field.dateOfIssue', 'dateOfIssue', true],
  ['clients.field.dateOfExpiry', 'dateOfExpiry', true],
  ['clients.field.issuingPlace', 'issuingPlace'],
  ['clients.field.referralAgent', 'referralAgent'],
];

const STATUS_I18N = {
  NEW: 'status.NEW',
  'DOCUMENTS SUBMITTED': 'status.DOCUMENTS',
  SUBMITTED: 'status.SUBMITTED',
  'UNDER REVIEW': 'status.UNDER_REVIEW',
  APPROVED: 'status.APPROVED',
  REJECTED: 'status.REJECTED',
};

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLang();
  const toast = useToast();

  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [docUrls, setDocUrls] = useState({});
  const [busyPdf, setBusyPdf] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [authPrompt, setAuthPrompt] = useState(false);

  const statusText = (s) => {
    const key = STATUS_I18N[s];
    return key ? t(key) : s || t('status.NEW');
  };

  const load = async () => {
    try {
      const record = await dbFetchClient(id);
      if (!record) {
        toast.error(t('clients.toastNotFound'));
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
      toast.error(t('clients.toastLoadClient'));
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
      toast.success(t('clients.toastStatusSet', { status: statusText(status) }));
    } catch (err) {
      toast.error(t('clients.toastStatusError'));
    }
  };

  const handleGeneratePdf = async () => {
    setBusyPdf(true);
    try {
      const { bytes, path } = await generateAndStoreClientPdf(client);
      setClient((prev) => ({ ...prev, pdfPath: path }));
      downloadBytes(bytes, clientPdfFilename(client));
      toast.success(t('clients.toastPdfOk'));
    } catch (err) {
      console.error(err);
      toast.error(t('clients.toastPdfError'));
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
      toast.error(t('clients.toastPdfDownloadError'));
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
    toast.info(t('clients.toastDeleted'));
  };

  if (loading || !client) {
    return (
      <div className="page page--wide clients-page">
        <div className="card">
          <div className="loading-row">
            <span className="spinner" aria-hidden="true" />
            {t('clients.loadingClient')}
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
          <h1>{clientFullName(client) || t('clients.client')}</h1>
          <p className="subtitle">
            {t('clients.passportLabel')} <span className="mono">{client.passport || '—'}</span> · {client.country || '—'} · {t('clients.agentLabel')}{' '}
            {client.referralAgent || '—'}
          </p>
        </div>
        <div className="editor-actions">
          <Link to="/clients" className="btn btn--neutral">
            {t('clients.backToClients')}
          </Link>
          <Can perm="action:client.save">
            <Link to={`/clients/${client.id}/edit`} className="btn btn--secondary">
              {t('common.edit')}
            </Link>
          </Can>
          <Can perm="action:client.delete">
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => setConfirmDelete(true)}
            >
              {t('common.delete')}
            </button>
          </Can>
        </div>
      </div>

      <section className="card cd-profile">
        <div className="cd-profile__info">
          <span className="cd-eyebrow">{t('clients.application')}</span>
          <div className="cd-profile__chips">
            <span className="cl-passport">{client.passport || '—'}</span>
            <span className="cd-chip">{client.country || '—'}</span>
            <span className="cd-chip">{t('clients.agentLabel')} · {client.referralAgent || '—'}</span>
          </div>
          <div className="cd-profile__status">
            <span className={`cbadge ${statusClass(client.status)}`}>
              {statusText(client.status)}
            </span>
            <Can perm="action:client.status">
              <div className="field cd-profile__select">
                <label htmlFor="client-status">{t('clients.applicationStatus')}</label>
                <select
                  id="client-status"
                  value={client.status || 'NEW'}
                  onChange={(e) => handleStatus(e.target.value)}
                >
                  {CLIENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {statusText(s)}
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
                {busyPdf ? (
                  <span className="btn__spinner" aria-hidden="true" />
                ) : (
                  t('clients.generatePdf')
                )}
              </button>
            </Can>
            <Can perm="action:client.pdf">
              {client.pdfPath && (
                <button type="button" className="btn btn--secondary" onClick={handleDownloadStored}>
                  {t('clients.downloadStoredPdf')}
                </button>
              )}
            </Can>
          </div>
          <p className="cd-profile__note">
            {t('clients.pdfNote')}
            {client.pdfPath ? t('clients.pdfNoteStored') : ''}
          </p>
        </div>
        <div className="cd-profile__photo">
          {photoUrl ? (
            <img className="cd-photo" src={photoUrl} alt={t('clients.client')} loading="lazy" decoding="async" />
          ) : (
            <div className="cd-photo cd-photo--empty">{t('clients.noPhoto')}</div>
          )}
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="card__header">
          <span className="card__icon" aria-hidden="true"><Icon name="user" /></span>
          <h2>{t('clients.recordTitle')}</h2>
        </div>
        <div className="card__body">
          <div className="cd-grid">
            {DETAIL_FIELDS.map(([label, key, isDate]) => (
              <div className="cd-item" key={key}>
                <div className="cd-item__label">{t(label)}</div>
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
          <h2>{t('clients.documents')}</h2>
        </div>
        <div className="card__body">
          <div className="cd-docs">
            {DOCUMENT_TYPES.map((def) => {
              const meta = client.documents?.[def.id];
              const url = docUrls[def.id];
              const defLabel = t(`clients.doc.${def.id}`);
              return (
                <div className="cd-doc" key={def.id}>
                  {url ? (
                    meta?.type === 'application/pdf' ? (
                      <div className="cd-doc__media cd-doc__media--missing">
                        {t('clients.pdfDocument')}
                      </div>
                    ) : (
                      <img className="cd-doc__media" src={url} alt={defLabel} loading="lazy" decoding="async" />
                    )
                  ) : (
                    <div className="cd-doc__media cd-doc__media--missing">
                      {t('clients.notUploaded')}
                    </div>
                  )}
                  <div className="cd-doc__body">
                    <strong>{defLabel}</strong>
                    <span className="cd-doc__name">{meta?.name || '—'}</span>
                    <div className="cl-actions">
                      {url && (
                        <a
                          className="btn btn--secondary btn--sm"
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t('clients.open')}
                        </a>
                      )}
                      <Can perm="action:client.upload">
                        <Link
                          className="btn btn--neutral btn--sm"
                          to={`/clients/${client.id}/edit`}
                        >
                          {meta ? t('clients.replace') : t('common.upload')}
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
          <h2>{t('clients.linkedInvoices')}</h2>
        </div>
        <div className="card__body">
          {invoices.length === 0 ? (
            <div className="cd-empty">
              {t('clients.noInvoiceBody1')}
              <br />
              {t('clients.noInvoiceCreate1')} <Link to="/create">{t('clients.invoiceSystem')}</Link>{' '}
              {t('clients.noInvoiceCreate2')}{' '}
              <strong>{client.passport || '—'}</strong> {t('clients.noInvoiceCreate3')}
            </div>
          ) : (
            <>
              <div className="cl-table-wrap">
                <table className="cl-table">
                  <thead>
                    <tr>
                      <th>{t('clients.invoiceNo')}</th>
                      <th>{t('clients.date')}</th>
                      <th>{t('clients.service')}</th>
                      <th>{t('common.total')}</th>
                      <th>{t('clients.paid')}</th>
                      <th>{t('clients.remaining')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((row) => (
                  <tr key={row.invoice.id}>
                    <td className="mono" data-label={t('clients.invoiceNo')}><span className="cell-v">{row.invoice.invoiceNumber}</span></td>
                    <td data-label={t('clients.date')}><span className="cell-v">{row.invoice.issueDate || '—'}</span></td>
                    <td data-label={t('clients.service')}><span className="cell-v">{serviceLabel(row.invoice.travel?.service) || '—'}</span></td>
                    <td data-label={t('common.total')}><span className="cell-v">{formatCurrency(row.payment.grandTotal)}</span></td>
                    <td data-label={t('clients.paid')}><span className="cell-v">{formatCurrency(row.calc.paid)}</span></td>
                    <td data-label={t('clients.remaining')}><span className="cell-v">{formatCurrency(row.calc.remaining)}</span></td>
                  </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="cd-totals">
                <span className="cd-total">
                  {t('common.total')} <b>{formatCurrency(totalInvoice)}</b>
                </span>
                <span className="cd-total cd-total--paid">
                  {t('clients.paid')} <b>{formatCurrency(totalPaid)}</b>
                </span>
                <span className="cd-total cd-total--remaining">
                  {t('clients.remaining')} <b>{formatCurrency(totalRemaining)}</b>
                </span>
              </div>
            </>
          )}
        </div>
      </section>

      <p className="history-note">
        {t('clients.historyNote')}
      </p>

      {confirmDelete && !authPrompt && (
        <Modal
          title={t('clients.deleteConfirmTitle')}
          danger
          onClose={() => setConfirmDelete(false)}
          actions={
            <>
              <button
                type="button"
                className="btn btn--neutral"
                onClick={() => setConfirmDelete(false)}
              >
                {t('common.cancel')}
              </button>
              <button type="button" className="btn btn--danger" onClick={() => setAuthPrompt(true)}>
                {t('clients.deleteClientBtn')}
              </button>
            </>
          }
        >
          <p>
            {t('clients.deleteDetailBody1')}{' '}
            <strong>{clientFullName(client)}</strong>
            {t('clients.deleteDetailBody2')}
          </p>
        </Modal>
      )}

      {confirmDelete && authPrompt && (
        <ConfirmAuthModal
          title={t('clients.confirmIdentity')}
          reason={t('clients.deleteReason', { name: clientFullName(client) })}
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
