import { useState } from 'react';
import Modal from '../Modal/Modal.jsx';
import { destinationLabel, serviceLabel } from '../../utils/labels.js';

const FIELD_LABELS = {
  invoiceNumber: 'Invoice No.',
  issueDate: 'Date',
  issueTime: 'Time',
  'customer.name': 'Customer',
  'customer.nationality': 'Nationality',
  'customer.passport': 'Passport',
  'customer.phone': 'Phone',
  'customer.email': 'Email',
  'travel.destination': 'Destination',
  'travel.service': 'Service',
  'travel.residenceType': 'Residence type',
  'payment.total': 'Total',
  'payment.paid': 'Paid',
  'payment.vatMode': 'VAT mode',
  notes: 'Notes',
  firstName: 'First name',
  secondName: 'Second name',
  thirdName: 'Third name',
  lastName: 'Last name',
  sex: 'Sex',
  birthDate: 'Birth date',
  country: 'Country / nationality',
  passportNumber: 'Passport no.',
  issuePlace: 'Passport issue place',
  issueDateClient: 'Passport issue date',
  expiryDate: 'Passport expiry',
  address: 'Address',
  status: 'Status',
  referralAgent: 'Referral agent',
  notesClient: 'Notes',
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
  const currentValues = flatten(current, '', {});
  const proposedValues = flatten(pending.payload, '', {});
  const keys = [...new Set([...Object.keys(currentValues), ...Object.keys(proposedValues)])]
    .filter((key) => formatValue(key, currentValues[key]) !== formatValue(key, proposedValues[key]));

  const title = entityType === 'invoice' ? 'Pending invoice edit' : 'Pending client edit';

  return (
    <Modal
      className="prv-modal"
      title={title}
      onClose={busy ? () => {} : onClose}
      actions={
        isAdmin ? (
          <>
            <button type="button" className="btn btn--neutral" onClick={onReject} disabled={busy}>
              Reject
            </button>
            <button type="button" className="btn btn--primary" onClick={onApprove} disabled={busy}>
              {busy ? 'Applying…' : 'Approve & apply'}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn--danger" onClick={onWithdraw} disabled={busy}>
              Cancel my request
            </button>
            <button type="button" className="btn btn--primary" onClick={onClose} disabled={busy}>
              Close
            </button>
          </>
        )
      }
    >
      <p className="prv-meta">
        Submitted by <b>{submitterName || '—'}</b> · {localStamp(pending.created_at)}
      </p>

      {keys.length === 0 ? (
        <p className="prv-note">No differences were found in the submitted values.</p>
      ) : (
        <table className="prv-diff">
          <thead>
            <tr>
              <th>Field</th>
              <th>Current</th>
              <th>Proposed</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr key={key}>
                <td>{FIELD_LABELS[key] || prettify(key)}</td>
                <td>{formatValue(key, currentValues[key])}</td>
                <td className="prv-diff__new">{formatValue(key, proposedValues[key])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!isAdmin && (
        <p className="prv-note">
          The record stays exactly as it is until an administrator approves these changes.
        </p>
      )}
    </Modal>
  );
}
