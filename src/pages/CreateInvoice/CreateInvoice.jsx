import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import InvoiceForm from '../../components/InvoiceForm/InvoiceForm.jsx';
import InvoicePreview from '../../components/InvoicePreview/InvoicePreview.jsx';
import Modal from '../../components/Modal/Modal.jsx';
import Can from '../../components/Can/Can.jsx';
import { useToast } from '../../components/Toast/ToastProvider.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
import { dbSubmitPending } from '../../lib/pendingRepo.js';
import company from '../../data/company.js';
import { nextInvoiceNumber, uniqueInvoiceNumber } from '../../utils/invoiceNumber.js';
import { formatDate, formatTime } from '../../utils/formatDate.js';
import { formatCurrency } from '../../utils/formatCurrency.js';
import {
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

/** Fields that are stored/displayed in capital letters (email is excluded). */
const UPPERCASE_FIELDS = ['name', 'nationality', 'passport'];

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
  const { needsEditApproval } = useAuth();
  const { t } = useLang();

  const editing = Boolean(id);
  const inputRef = useRef(null);
  const mountedRef = useRef(true);

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
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
  /* Id of the invoice this screen already saved in create mode — every later
     save updates that row instead of inserting a duplicate. */
  const [savedId, setSavedId] = useState(null);

  const draftRef = useRef(null);

  const changeForm = useCallback(
    (field, value) => {
      const nextValue = UPPERCASE_FIELDS.includes(field)
        ? String(value ?? '').toUpperCase()
        : value;
      setForm((prev) => ({ ...prev, [field]: nextValue }));
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
    let cancelled = false;

    const setFallbackNumber = () => {
      setInvoiceNumber(`INV-${new Date().getFullYear()}-0001`);
    };

    (async () => {
      try {
        if (editing && id) {
          const inv = await getInvoiceById(id);
          if (!mountedRef.current || cancelled) return;
          if (!inv) {
            toast.error(t('invoice.notFound'));
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
          const draft = getDraft();
          let number;
          try {
            number = await nextInvoiceNumber();
          } catch (err) {
            number = '';
          }
          if (!mountedRef.current || cancelled) return;
          setInvoiceNumber(number || null);
          if (!number) setFallbackNumber();
          setIssueDateDisplay(formatDate());
          setIssueTimeDisplay(formatTime());

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
      } catch (err) {
        // Database unreachable — still show the form so the user can work;
        // saving will re-surface the error with a clear message.
        console.error('Failed to initialize invoice page:', err);
        if (!mountedRef.current || cancelled) return;
        setFallbackNumber();
        setIssueDateDisplay(formatDate());
        setIssueTimeDisplay(formatTime());
      } finally {
        if (!mountedRef.current || cancelled) return;
        setLoading(false);
      }
    })();

    const handleBeforeUnload = (e) => {
      if (draftRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      mountedRef.current = false;
      cancelled = true;
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
    if (isEmptyField(name)) next.name = t('invoice.errNameRequired');
    if (isEmptyField(form.nationality)) next.nationality = t('invoice.errNationalityRequired');
    if (isEmptyField(form.passport)) next.passport = t('invoice.errPassportRequired');
    if (isEmptyField(form.phone)) next.phone = t('invoice.errPhoneRequired');
    if (isEmptyField(form.destination)) next.destination = t('invoice.errDestinationRequired');
    if (isEmptyField(form.service)) next.service = t('invoice.errServiceRequired');

    const total = Number(form.total);
    if (form.total === '' || form.total === null || Number.isNaN(total) || total <= 0) {
      next.total = t('invoice.errTotalZero');
    }

    const paid = Number(form.paid) || 0;
    const grandTotal = calculateVat(form.total, form.vatMode).grandTotal;
    if (paid > grandTotal) next.paid = t('invoice.errPaidExceeds');

    if (!isEmailValid(form.email)) next.email = t('invoice.errEmailInvalid');
    if (!isPhoneValid(form.phone)) next.phone = t('invoice.errPhoneInvalid');

    return next;
  };

  /* ---------- Save ---------- */
  /**
   * Cleans the form and returns the invoice object that would be written
   * to the database (without writing anything).
   */
  const buildInvoice = async () => {
    const cleaned = {
      ...form,
      name: normalizeName(form.name),
      passport: String(form.passport || '').trim(),
      nationality: String(form.nationality || '').trim(),
    };

    const targetId = editing ? id : savedId;
    const number = await uniqueInvoiceNumber(invoiceNumber, { ignoreId: targetId });
    setInvoiceNumber(number);

    const invoice = createInvoiceObject(cleaned, number);

    if (targetId) {
      invoice.id = targetId;
      invoice.issueDate = issueDateDisplay;
      invoice.issueTime = issueTimeDisplay;
    }

    return { invoice, targetId };
  };

  /**
   * Writes the current form to the database.
   * Returns the saved invoice, or null when the update matched no row.
   */
  const persistInvoice = async () => {
    const { invoice, targetId } = await buildInvoice();

    if (targetId) return updateInvoice(invoice);

    const result = await saveInvoice(invoice);
    clearDraft();
    return result;
  };

  const handleSave = async () => {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error(t('invoice.fixFields'));
      return;
    }

    setSaving(true);
    try {
      if (editing && needsEditApproval) {
        /* Admin approval workflow: the proposal is stored, the record
           keeps its current values until an admin applies it. */
        const { invoice } = await buildInvoice();
        await dbSubmitPending('invoice', invoice.id, invoice);
        toast.success(t('invoice.submittedForApproval'));
        navigate('/history');
        return;
      }

      const result = await persistInvoice();
      if (!result) {
        toast.error(t('invoice.updateFailed'));
        return;
      }
      if (editing) {
        toast.success(t('invoice.updatedSuccess'));
      } else {
        setForm(EMPTY_FORM);
        setDirty(false);
        setSavedId(null);
        toast.success(t('invoice.savedSuccess'));
      }

      setSavedInvoice(result);
      setSavedActionsOpen(true);
    } catch (err) {
      console.error('Failed to save invoice:', err);
      const detail =
        (err && (err.message || (err.error_description || ''))) || '';
      toast.error(detail ? t('invoice.saveFailedDetail', { detail }) : t('invoice.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Save, then export / print ---------- */
  const exportSaved = async (saved) => {
    setExporting(true);
    try {
      await exportInvoicePdf(saved);
      toast.success(t('invoice.pdfExported'));
    } catch (err) {
      toast.error(t('invoice.pdfExportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const printSaved = async (saved) => {
    try {
      await printInvoicePdf(saved);
    } catch (err) {
      toast.error(t('invoice.printDialogFailed'));
    }
  };

  /** Required behaviour: EXPORT PDF / PRINT INVOICE save the invoice first. */
  const saveThen = async (nextStep) => {
    if (editing && needsEditApproval) {
      toast.error(t('invoice.approvalRequiredExport'));
      return;
    }

    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast.error(t('invoice.fixFieldsBefore'));
      return;
    }

    setSaving(true);
    let saved = null;
    try {
      saved = await persistInvoice();
    } catch (err) {
      console.error('Failed to save invoice:', err);
      toast.error(t('invoice.saveFailed'));
      return;
    } finally {
      setSaving(false);
    }

    if (!saved) {
      toast.error(t('invoice.saveFailed'));
      return;
    }
    if (!editing) {
      setSavedId(saved.id);
      setDirty(false);
    }

    await nextStep(saved);
  };

  /* ---------- Clear / New ---------- */
  const resetForm = () => {
    clearDraft();
    setForm(EMPTY_FORM);
    setErrors({});
    setInvoiceNumber('');
    setSavedId(null);
    setIssueDateDisplay(formatDate());
    setIssueTimeDisplay(formatTime());
    setDirty(false);
    nextInvoiceNumber().then(setInvoiceNumber);
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
    toast.info(t('invoice.formCleared'));
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
          <h1>{editing ? t('invoice.editTitle') : t('invoice.createTitle')}</h1>
          <p className="subtitle">
            {editing
              ? t('invoice.editSubtitle')
              : t('invoice.createSubtitle')}
          </p>
        </div>
        <div className="editor-actions">
          {editing && (
            <button type="button" className="btn btn--neutral" onClick={() => navigate('/history')}>
              {t('invoice.backToHistory')}
            </button>
          )}
          <button type="button" className="btn btn--neutral" onClick={handleNew}>
            {t('invoice.newInvoice')}
          </button>
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => setClearPrompt(true)}
            disabled={saving || exporting}
            style={editing ? { display: 'none' } : undefined}
          >
            {t('invoice.clearForm')}
          </button>
          <Can perm="action:invoice.export_pdf">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => saveThen(printSaved)}
              disabled={saving || exporting}
            >
              {t('invoice.printInvoice')}
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => saveThen(exportSaved)}
              disabled={saving || exporting}
            >
              {exporting ? <span className="btn__spinner" aria-hidden="true" /> : t('invoice.exportPdf')}
            </button>
          </Can>
          <Can perm="action:invoice.save">
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleSave}
              disabled={saving || exporting}
            >
              {saving ? <span className="btn__spinner" aria-hidden="true" /> : editing ? t('invoice.updateInvoice') : t('invoice.saveInvoice')}
            </button>
          </Can>
        </div>
      </div>

      {loading ? (
        <div className="card">
          <div className="loading-row">
            <span className="spinner" aria-hidden="true" />
            {t('invoice.loadingInvoice')}
          </div>
        </div>
      ) : (
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
              <h2>{t('invoice.livePreview')}</h2>
              <span className="preview-scale">A4 · {formatCurrency(calculateVat(form.total, form.vatMode).grandTotal)}</span>
            </div>
            <div className="invoice-sheet-wrap">
              <div id="invoice-sheet">
                <InvoicePreview form={previewForm} invoiceNumber={invoiceNumber} />
              </div>
            </div>

            <div className="preview-actions">
              <Can perm="action:invoice.export_pdf">
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => saveThen(exportSaved)}
                  disabled={saving || exporting}
                >
                  {exporting ? <span className="btn__spinner" aria-hidden="true" /> : t('invoice.exportPdf')}
                </button>
              </Can>
              <Can perm="action:invoice.save">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handleSave}
                  disabled={saving || exporting}
                >
                  {saving ? (
                    <span className="btn__spinner" aria-hidden="true" />
                  ) : editing ? (
                    t('invoice.updateInvoice')
                  ) : (
                    t('invoice.saveInvoice')
                  )}
                </button>
              </Can>
            </div>
          </div>
        </div>
      )}

      {draftPrompt && (
        <Modal
          title={t('invoice.draftTitle')}
          onClose={() => setDraftPrompt(false)}
          actions={
            <>
              <button type="button" className="btn btn--neutral" onClick={handleDiscardDraft}>
                {t('invoice.discard')}
              </button>
              <button type="button" className="btn btn--primary" onClick={handleResumeDraft}>
                {t('invoice.resume')}
              </button>
            </>
          }
        >
          <p>{t('invoice.draftBody')}</p>
        </Modal>
      )}

      {clearPrompt && (
        <Modal
          title={t('invoice.clearTitle')}
          onClose={() => setClearPrompt(false)}
          danger
          actions={
            <>
              <button type="button" className="btn btn--neutral" onClick={() => setClearPrompt(false)}>
                {t('common.cancel')}
              </button>
              <button type="button" className="btn btn--danger" onClick={confirmClear}>
                {t('invoice.clearInvoice')}
              </button>
            </>
          }
        >
          <p>{t('invoice.clearBody')}</p>
        </Modal>
      )}

      {savedActionsOpen && savedInvoice && (
        <Modal
          title={editing ? t('invoice.updatedTitle') : t('invoice.savedTitle')}
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
                {t('invoice.newInvoice')}
              </button>
              <Can perm="action:invoice.export_pdf">
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => {
                    exportInvoicePdf(savedInvoice)
                      .then(() => toast.success(t('invoice.pdfExported')))
                      .catch(() => toast.error(t('invoice.pdfExportFailed')));
                  }}
                >
                  {t('invoice.exportPdf')}
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => {
                    setSavedActionsOpen(false);
                    setSavedInvoice(null);
                    printInvoicePdf(savedInvoice)
                      .then(() => {})
                      .catch(() => toast.error(t('invoice.printDialogFailed')));
                  }}
                >
                  {t('common.print')}
                </button>
              </Can>
            </>
          }
        >
          <p>
            {t('invoice.savedBefore')} <strong>{savedInvoice.invoiceNumber}</strong> {t('invoice.savedAfter')}
          </p>
        </Modal>
      )}

      <p className="legend">{company.name} · {t('invoice.storedLocally')}</p>
    </div>
  );
}
