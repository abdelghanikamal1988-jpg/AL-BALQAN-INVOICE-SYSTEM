import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import InvoiceForm from '../../components/InvoiceForm/InvoiceForm.jsx';
import InvoicePreview from '../../components/InvoicePreview/InvoicePreview.jsx';
import Modal from '../../components/Modal/Modal.jsx';
import { useToast } from '../../components/Toast/ToastProvider.jsx';
import company from '../../data/company.js';
import { nextInvoiceNumber, uniqueInvoiceNumber } from '../../utils/invoiceNumber.js';
import { formatDate, formatTime } from '../../utils/formatDate.js';
import { formatCurrency } from '../../utils/formatCurrency.js';
import {
  getInvoices,
  getInvoiceById,
  saveInvoice,
  updateInvoice,
  getDraft,
  saveDraft,
  clearDraft,
  createInvoiceObject,
} from '../../utils/storage.js';
import { exportInvoicePdf, printInvoicePdf } from '../../utils/pdf.js';
import { normalizeName, isEmailValid, isPhoneValid, isEmptyField } from '../../utils/validation.js';
import { calculateVat } from '../../utils/vat.js';

const EMPTY_FORM = {
  name: '',
  nationality: '',
  passport: '',
  phone: '',
  email: '',
  destination: '',
  service: '',
  residenceType: '',
  total: '',
  paid: '',
  vatMode: 'none',
  notes: '',
};

export default function CreateInvoice() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const editing = Boolean(id);
  const inputRef = useRef(null);
  const mountedRef = useRef(true);

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDateDisplay, setIssueDateDisplay] = useState(formatDate());
  const [issueTimeDisplay, setIssueTimeDisplay] = useState(formatTime());
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState(false);
  const [savedInvoice, setSavedInvoice] = useState(null);
  const [savedActionsOpen, setSavedActionsOpen] = useState(false);
  const [clearPrompt, setClearPrompt] = useState(false);

  const draftRef = useRef(null);

  const changeForm = useCallback(
    (field, value) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setDirty(true);
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    []
  );

  /* ---------- Initial load ---------- */
  useEffect(() => {
    mountedRef.current = true;
    if (editing && id) {
      const inv = getInvoiceById(id);
      if (!inv) {
        toast.error('Invoice not found.');
        navigate('/history', { replace: true });
        return;
      }
      setForm({
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
      });
      setInvoiceNumber(inv.invoiceNumber);
      setIssueDateDisplay(inv.issueDate || formatDate());
      setIssueTimeDisplay(inv.issueTime || formatTime());
      setDirty(false);
    } else {
      const number = nextInvoiceNumber();
      setInvoiceNumber(number);
      setIssueDateDisplay(formatDate());
      setIssueTimeDisplay(formatTime());

      const draft = getDraft();
      if (draft && draft.form && draft.form.name) {
        setForm({ ...EMPTY_FORM, ...draft.form });
        if (draft.invoiceNumber) setInvoiceNumber(draft.invoiceNumber);
        setDraftPrompt(true);
      }
      // Autofocus Customer Name (per spec §15)
      requestAnimationFrame(() => {
        if (inputRef.current) inputRef.current.focus();
      });
    }

    const handleBeforeUnload = (e) => {
      if (draftRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      mountedRef.current = false;
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, editing]);

  /* ---------- Draft autosave (create mode only) ---------- */
  useEffect(() => {
    draftRef.current = dirty;
    if (editing || !dirty) return;
    const t = setTimeout(() => {
      saveDraft({ form, invoiceNumber, savedAt: Date.now() });
    }, 600);
    return () => clearTimeout(t);
  }, [form, invoiceNumber, dirty, editing]);

  /* ---------- Validation ---------- */
  const validate = () => {
    const next = {};
    const name = normalizeName(form.name);
    if (isEmptyField(name)) next.name = 'Customer full name is required.';
    if (isEmptyField(form.destination)) next.destination = 'Please select a destination.';
    if (isEmptyField(form.service)) next.service = 'Please select a service type.';

    const total = Number(form.total);
    if (form.total === '' || form.total === null || Number.isNaN(total) || total <= 0) {
      next.total = 'Total must be greater than zero.';
    }

    const paid = Number(form.paid) || 0;
    const grandTotal = calculateVat(form.total, form.vatMode).grandTotal;
    if (paid > grandTotal) next.paid = 'Paid amount cannot be greater than the total.';

    if (!isEmailValid(form.email)) next.email = 'Please enter a valid email address.';
    if (!isPhoneValid(form.phone)) next.phone = 'Please enter a valid phone number.';

    return next;
  };

  /* ---------- Save ---------- */
  const handleSave = () => {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error('Please fix the highlighted fields.');
      return;
    }

    setSaving(true);
    try {
      const cleaned = {
        ...form,
        name: normalizeName(form.name),
        passport: String(form.passport || '').trim(),
        nationality: String(form.nationality || '').trim(),
      };

      const number = uniqueInvoiceNumber(invoiceNumber, { ignoreId: id });
      setInvoiceNumber(number);

      const invoice = createInvoiceObject(cleaned, number);

      let result;
      if (editing && id) {
        invoice.id = id;
        invoice.issueDate = issueDateDisplay;
        invoice.issueTime = issueTimeDisplay;
        result = updateInvoice(invoice);
        if (!result) {
          toast.error('Unable to update the invoice. Please try again.');
          return;
        }
        toast.success('Invoice updated successfully.');
      } else {
        result = saveInvoice(invoice);
        clearDraft();
        setForm(EMPTY_FORM);
        setDirty(false);
        toast.success('Invoice saved successfully.');
      }

      setSavedInvoice(result);
      setSavedActionsOpen(true);
    } catch (err) {
      toast.error('Unable to save the invoice. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Print ---------- */
  const buildInvoiceData = () => ({
    invoiceNumber,
    issueDate: issueDateDisplay,
    issueTime: issueTimeDisplay,
    customer: {
      name: normalizeName(form.name),
      nationality: String(form.nationality || '').trim(),
      passport: String(form.passport || '').trim(),
      phone: form.phone,
      email: form.email,
    },
    travel: {
      destination: form.destination,
      service: form.service,
      residenceType: form.residenceType,
    },
    payment: {
      total: form.total,
      paid: form.paid,
      vatMode: form.vatMode || 'none',
    },
    notes: form.notes,
  });

  const handlePrint = async () => {
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast.error('Please fix the highlighted fields before printing.');
      return;
    }
    try {
      await printInvoicePdf(buildInvoiceData());
    } catch (err) {
      toast.error("Unable to open the print dialog. Please use your browser's print command.");
    }
  };

  /* ---------- PDF ---------- */
  const handlePdf = async () => {
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast.error('Please fix the highlighted fields before exporting.');
      return;
    }
    setExporting(true);
    try {
      await exportInvoicePdf(buildInvoiceData());
      toast.success('PDF exported successfully.');
    } catch (err) {
      toast.error('Unable to export PDF. Please try again or use Print.');
    } finally {
      setExporting(false);
    }
  };

  /* ---------- Clear / New ---------- */
  const resetForm = () => {
    clearDraft();
    setForm(EMPTY_FORM);
    setErrors({});
    setInvoiceNumber(nextInvoiceNumber());
    setIssueDateDisplay(formatDate());
    setIssueTimeDisplay(formatTime());
    setDirty(false);
    requestAnimationFrame(() => {
      if (inputRef.current) inputRef.current.focus();
    });
  };

  const handleNew = () => {
    if (editing) {
      navigate('/create');
      return;
    }
    if (dirty) {
      setClearPrompt(true);
      return;
    }
    resetForm();
  };

  const confirmClear = () => {
    setClearPrompt(false);
    resetForm();
    toast.info('Form cleared. Starting a new invoice.');
  };

  const handleResumeDraft = () => {
    setDraftPrompt(false);
    setDirty(true);
  };

  const handleDiscardDraft = () => {
    clearDraft();
    setDraftPrompt(false);
    setForm(EMPTY_FORM);
  };

  const previewForm = useMemo(
    () => ({ ...form, issueDateDisplay, issueTimeDisplay }),
    [form, issueDateDisplay, issueTimeDisplay]
  );

  return (
    <div className="page page--wide">
      <div className="page-header">
        <div>
          <h1>{editing ? 'Edit Invoice' : 'Create Invoice'}</h1>
          <p className="subtitle">
            {editing
              ? 'Update the invoice. Invoice number, issue date and time stay unchanged.'
              : 'Fill in the details — the preview updates instantly.'}
          </p>
        </div>
        <div className="editor-actions">
          {editing && (
            <button type="button" className="btn btn--neutral" onClick={() => navigate('/history')}>
              Back to History
            </button>
          )}
          <button type="button" className="btn btn--neutral" onClick={handleNew}>
            New Invoice
          </button>
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => setClearPrompt(true)}
            disabled={saving || exporting}
            style={editing ? { display: 'none' } : undefined}
          >
            Clear Form
          </button>
          <button type="button" className="btn btn--secondary" onClick={() => handlePrint()} disabled={saving || exporting}>
            Print Invoice
          </button>
          <button type="button" className="btn btn--secondary" onClick={() => handlePdf()} disabled={saving || exporting}>
            {exporting ? <span className="btn__spinner" aria-hidden="true" /> : 'Export PDF'}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleSave}
            disabled={saving || exporting}
          >
            {saving ? <span className="btn__spinner" aria-hidden="true" /> : editing ? 'Update Invoice' : 'Save Invoice'}
          </button>
        </div>
      </div>

      <div className="editor-layout">
        <InvoiceForm
          form={form}
          errors={errors}
          onChange={changeForm}
          invoiceNumber={invoiceNumber}
          issueDateDisplay={issueDateDisplay}
          issueTimeDisplay={issueTimeDisplay}
          inputRef={inputRef}
        />

        <div className="preview-sticky">
          <div className="preview-toolbar">
            <h2>Live Preview</h2>
            <span className="preview-scale">A4 · {formatCurrency(calculateVat(form.total, form.vatMode).grandTotal)}</span>
          </div>
          <div className="invoice-sheet-wrap">
            <div id="invoice-sheet">
              <InvoicePreview form={previewForm} invoiceNumber={invoiceNumber} />
            </div>
          </div>
        </div>
      </div>

      {draftPrompt && (
        <Modal
          title="Unfinished invoice found"
          onClose={() => setDraftPrompt(false)}
          actions={
            <>
              <button type="button" className="btn btn--neutral" onClick={handleDiscardDraft}>
                Discard
              </button>
              <button type="button" className="btn btn--primary" onClick={handleResumeDraft}>
                Resume
              </button>
            </>
          }
        >
          <p>You have an unfinished invoice. Do you want to resume it?</p>
        </Modal>
      )}

      {clearPrompt && (
        <Modal
          title="Clear current invoice?"
          onClose={() => setClearPrompt(false)}
          danger
          actions={
            <>
              <button type="button" className="btn btn--neutral" onClick={() => setClearPrompt(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn--danger" onClick={confirmClear}>
                Clear Invoice
              </button>
            </>
          }
        >
          <p>Any unsaved changes in this form will be lost. Continue?</p>
        </Modal>
      )}

      {savedActionsOpen && savedInvoice && (
        <Modal
          title={editing ? 'Invoice updated successfully' : 'Invoice saved successfully'}
          onClose={() => {
            setSavedActionsOpen(false);
            setSavedInvoice(null);
          }}
          actions={
            <>
              <button
                type="button"
                className="btn btn--neutral"
                onClick={() => {
                  setSavedActionsOpen(false);
                  setSavedInvoice(null);
                  resetForm();
                  if (editing) navigate('/create');
                }}
              >
                New Invoice
              </button>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  exportInvoicePdf(savedInvoice)
                    .then(() => toast.success('PDF exported successfully.'))
                    .catch(() => toast.error('Unable to export PDF. Please try again or use Print.'));
                }}
              >
                Export PDF
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  setSavedActionsOpen(false);
                  setSavedInvoice(null);
                  printInvoicePdf(savedInvoice)
                    .then(() => {})
                    .catch(() => toast.error("Unable to open the print dialog. Please use your browser's print command."));
                }}
              >
                Print
              </button>
            </>
          }
        >
          <p>
            Invoice <strong>{savedInvoice.invoiceNumber}</strong> has been saved to your local
            invoice history.
          </p>
        </Modal>
      )}

      <p className="legend">{company.name} · Invoices are stored locally on this device.</p>
    </div>
  );
}
