import { useState } from 'react';
import Modal from '../Modal/Modal.jsx';
import { useLang } from '../../context/LangContext.jsx';
import { destinationLabel, serviceLabel } from '../../utils/labels.js';

const FIELD_LABELS = {
  invoiceNumber: 'shell.field.invoiceNumber',
  issueDate: 'shell.field.issueDate',
  issueTime: 'shell.field.issueTime',
  'customer.name': 'shell.field.customerName',
  'customer.nationality': 'shell.field.nationality',
  'customer.passport': 'shell.field.passport',
  'customer.phone': 'shell.field.phone',
  'customer.email': 'shell.field.email',
  'travel.destination': 'shell.field.destination',
  'travel.service': 'shell.field.service',
  'travel.residenceType': 'shell.field.residenceType',
  'payment.total': 'shell.field.total',
  'payment.paid': 'shell.field.paid',
  'payment.vatMode': 'shell.field.vatMode',
  notes: 'shell.field.notes',
  firstName: 'shell.field.firstName',
  secondName: 'shell.field.secondName',
  thirdName: 'shell.field.thirdName',
  lastName: 'shell.field.lastName',
  sex: 'shell.field.sex',
  birthDate: 'shell.field.birthDate',
  country: 'shell.field.country',
  passportNumber: 'shell.field.passportNumber',
  issuePlace: 'shell.field.issuePlace',
  issueDateClient: 'shell.field.issueDateClient',
  expiryDate: 'shell.field.expiryDate',
  address: 'shell.field.address',
  status: 'shell.field.status',
  referralAgent: 'shell.field.referralAgent',
  notesClient: 'shell.field.notesClient',
};

/** Never shown in the diff (identifiers, media metadata, audit stamps). */
const SKIP_KEYS = new Set([
  'rowIndex',
  'id',
  'documents',
  'pdfPath',
  'createdBy',
  'editedBy',
  'editedAt',
  'updatedAt',
  'updatedAtClient',
]);

function flatten(value, prefix, out) {
  Object.entries(value || {}).forEach(([key, val]) => {
    if (SKIP_KEYS.has(key)) return;
    const path = prefix ? `${prefix}.${key}` : key;
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      flatten(val, path, out);
    } else {
      out[path] = val;
    }
  });
  return out;
}

function prettify(path) {
  const last = path.split('.').pop();
  const words = last.replace(/([A-Z])/g, ' $1').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatValue(path, value) {
  if (value === null || value === undefined || value === '') return '—';
  if (path.endsWith('.destination')) return destinationLabel(value);
  if (path.endsWith('.service')) return serviceLabel(value);
  if (path === 'payment.vatMode') return String(value).toUpperCase();
  return String(value);
}

function localStamp(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch (err) {
    return iso;
  }
}

/**
 * Diff view for one pending edit proposal plus the approval actions.
 * Admins get Approve / Reject; the submitting user gets Close /
 * Cancel my request. Everything else (the record itself) is untouched.
 */
export default function PendingReviewModal({
  pending,
  current,
  submitterName,
  entityType,
  isAdmin,
  busy = false,
  onApprove,
  onReject,
  onWithdraw,
  onClose,
}) {
  const { t } = useLang();
  const currentValues = flatten(current, '', {});
  const proposedValues = flatten(pending.payload, '', {});
  const keys = [...new Set([...Object.keys(currentValues), ...Object.keys(proposedValues)])]
    .filter((key) => formatValue(key, currentValues[key]) !== formatValue(key, proposedValues[key]));

  const title =
    entityType === 'invoice' ? t('shell.pendingInvoiceEdit') : t('shell.pendingClientEdit');

  return (
    <Modal
      className="prv-modal"
      title={title}
      onClose={busy ? () => {} : onClose}
      actions={
        isAdmin ? (
          <>
            <button type="button" className="btn btn--neutral" onClick={onReject} disabled={busy}>
              {t('shell.reject')}
            </button>
            <button type="button" className="btn btn--primary" onClick={onApprove} disabled={busy}>
              {busy ? t('shell.applying') : t('shell.approveApply')}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn--danger" onClick={onWithdraw} disabled={busy}>
              {t('shell.cancelRequest')}
            </button>
            <button type="button" className="btn btn--primary" onClick={onClose} disabled={busy}>
              {t('shell.close')}
            </button>
          </>
        )
      }
    >
      <p className="prv-meta">
        {t('shell.submittedBy')} <b>{submitterName || '—'}</b> · {localStamp(pending.created_at)}
      </p>

      {keys.length === 0 ? (
        <p className="prv-note">{t('shell.noDifferences')}</p>
      ) : (
        <table className="prv-diff">
          <thead>
            <tr>
              <th>{t('shell.diffField')}</th>
              <th>{t('shell.diffCurrent')}</th>
              <th>{t('shell.diffProposed')}</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr key={key}>
                <td>{t(FIELD_LABELS[key] || prettify(key))}</td>
                <td>{formatValue(key, currentValues[key])}</td>
                <td className="prv-diff__new">{formatValue(key, proposedValues[key])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!isAdmin && (
        <p className="prv-note">{t('shell.recordStaysNote')}</p>
      )}
    </Modal>
  );
}
