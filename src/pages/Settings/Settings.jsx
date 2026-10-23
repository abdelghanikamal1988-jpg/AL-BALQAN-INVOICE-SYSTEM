import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icons/Icon.jsx';
import Modal from '../../components/Modal/Modal.jsx';
import { useToast } from '../../components/Toast/ToastProvider.jsx';
import { useLang } from '../../context/LangContext.jsx';
import {
  activeTotpFactor,
  enrollTotp,
  createChallenge,
  verifyChallenge,
  unenrollFactor,
} from '../../utils/mfa.js';
import {
  getSettings,
  saveSettings,
  resetSettings,
  normalizeVatRate,
} from '../../utils/settings.js';
import { exportFullBackup, parseBackupText, restoreBackup } from '../../utils/backup.js';
import '../../styles/settings.css';

export default function Settings() {
  const toast = useToast();
  const { t } = useLang();
  const [form, setForm] = useState(() => getSettings());
  const [vatError, setVatError] = useState('');
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restorePreview, setRestorePreview] = useState(null);
  const restoreInputRef = useRef(null);

  /* -------- Optional two-factor authentication (TOTP) -------- */
  const [mfaFactor, setMfaFactor] = useState(null);
  const [mfaPending, setMfaPending] = useState(null); // { id, qrCode, uri, secret }
  const [mfaChallengeId, setMfaChallengeId] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);
  const mfaCodeRef = useRef(null);

  useEffect(() => {
    let active = true;
    activeTotpFactor()
      .then((f) => active && setMfaFactor(f))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (mfaPending) mfaCodeRef.current?.focus();
  }, [mfaPending]);

  const mfaEnable = async () => {
    setMfaBusy(true);
    try {
      const pending = await enrollTotp();
      setMfaPending(pending);
      setMfaCode('');
      const challenge = await createChallenge(pending.id);
      setMfaChallengeId(challenge.id);
    } catch (err) {
      if (err && err.mfaAlreadyOn) {
        toast.error(t('settings.mfa.alreadyOn'));
        activeTotpFactor().then((f) => setMfaFactor(f)).catch(() => {});
      } else {
        toast.error(err.message || t('settings.mfa.enableError'));
      }
    } finally {
      setMfaBusy(false);
    }
  };

  const mfaConfirm = async (e) => {
    e.preventDefault();
    const code = mfaCode.trim();
    if (!/^\d{6}$/.test(code) || !mfaPending || !mfaChallengeId) {
      toast.error(t('settings.mfa.codeInvalid'));
      return;
    }
    setMfaBusy(true);
    try {
      await verifyChallenge(mfaPending.id, mfaChallengeId, code);
      setMfaFactor(await activeTotpFactor());
      setMfaPending(null);
      setMfaChallengeId(null);
      setMfaCode('');
      toast.success(t('settings.mfa.enabled'));
    } catch (err) {
      toast.error(err.message || t('settings.mfa.codeWrong'));
      setMfaCode('');
      try {
        const challenge = await createChallenge(mfaPending.id);
        setMfaChallengeId(challenge.id);
      } catch {
        /* keep the previous challenge id */
      }
      mfaCodeRef.current?.focus();
    } finally {
      setMfaBusy(false);
    }
  };

  const mfaCancel = () => {
    if (mfaPending) unenrollFactor(mfaPending.id).catch(() => null);
    setMfaPending(null);
    setMfaChallengeId(null);
    setMfaCode('');
  };

  const mfaDisable = async () => {
    if (!mfaFactor) return;
    setMfaBusy(true);
    try {
      await unenrollFactor(mfaFactor.id);
      setMfaFactor(null);
      toast.success(t('settings.mfa.disabled'));
    } catch (err) {
      toast.error(err.message || t('settings.mfa.disableError'));
    } finally {
      setMfaBusy(false);
    }
  };

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === 'vatRate') setVatError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const n = Number(form.vatRate);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      setVatError(t('settings.errVatRate'));
      return;
    }
    const saved = saveSettings({ ...form, vatRate: normalizeVatRate(n) });
    setForm(saved);
    toast.success(t('settings.toastSaved'));
  };

  const handleReset = () => {
    const cleared = resetSettings();
    setForm(cleared);
    setVatError('');
    toast.info(t('settings.toastReset'));
  };

  const handleBackup = async () => {
    setBackingUp(true);
    try {
      const { ok, failed, counts } = await exportFullBackup();
      const total = counts.invoices + counts.clients + counts.consultations;
      if (total === 0) {
        toast.info(t('settings.backupEmpty'));
      } else if (ok) {
        toast.success(
          t('settings.backupSummary', {
            invoices: counts.invoices,
            clients: counts.clients,
            consultations: counts.consultations,
          })
        );
      } else {
        toast.info(
          t('settings.backupPartial', { sections: failed.join(', ') })
        );
      }
    } catch (err) {
      console.error('Backup failed:', err);
      toast.error(t('settings.backupFailed'));
    } finally {
      setBackingUp(false);
    }
  };

  /* ---------- Restore ---------- */
  const handleRestoreFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const data = parseBackupText(text);
      const n = (v) => (Array.isArray(v) ? v.length : 0);
      setRestorePreview({
        data,
        counts: {
          invoices: n(data.invoices),
          clients: n(data.clients),
          agents: n(data.agents),
        },
      });
    } catch (err) {
      const key =
        err?.message === 'backup_invalid_json'
          ? 'settings.restoreInvalidJson'
          : err?.message === 'backup_wrong_format'
            ? 'settings.restoreWrongFormat'
            : err?.message === 'backup_unsupported_version'
              ? 'settings.restoreVersion'
              : 'settings.restoreReadFailed';
      toast.error(t(key));
    }
  };

  const confirmRestore = async () => {
    if (!restorePreview) return;
    setRestoring(true);
    try {
      const result = await restoreBackup(restorePreview.data);
      setRestorePreview(null);
      if (result.invoicesAdded + result.clientsAdded + result.agentsAdded === 0) {
        toast.info(t('settings.restoreNothingNew'));
      } else {
        toast.success(
          t('settings.restoreSummary', {
            invoices: result.invoicesAdded,
            clients: result.clientsAdded,
            agents: result.agentsAdded,
          })
        );
      }
    } catch {
      toast.error(t('settings.restoreFailed'));
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="page settings-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">SYSTEM</p>
          <h1>{t('settings.title')}</h1>
          <p className="subtitle">{t('settings.subtitle')}</p>
        </div>
        <div className="page-header__right">
          <ul className="crumbs">
            <li>
              <Link to="/">{t('settings.home')}</Link>
            </li>
            <li>
              <span className="crumbs__cur">{t('settings.title')}</span>
            </li>
          </ul>
        </div>
      </div>

      <form id="settings-form" onSubmit={handleSubmit}>
        <div className="editor-form settings-form">
          <section className="card" aria-label={t('settings.section.company')}>
            <div className="card__header">
              <span className="card__icon" aria-hidden="true">
                <Icon name="folder" />
              </span>
              <h2>{t('settings.section.company')}</h2>
            </div>
            <div className="card__body">
              <p className="fieldset-note">{t('settings.note')}</p>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="set-companyName">{t('settings.companyName')}</label>
                  <input
                    id="set-companyName"
                    type="text"
                    value={form.companyName}
                    onChange={(e) => setField('companyName', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="set-legalName">{t('settings.legalName')}</label>
                  <input
                    id="set-legalName"
                    type="text"
                    value={form.legalName}
                    onChange={(e) => setField('legalName', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="set-licenseNo">{t('settings.licenseNo')}</label>
                  <input
                    id="set-licenseNo"
                    type="text"
                    value={form.licenseNo}
                    onChange={(e) => setField('licenseNo', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="set-trn">{t('settings.trn')}</label>
                  <input
                    id="set-trn"
                    type="text"
                    value={form.trn}
                    onChange={(e) => setField('trn', e.target.value)}
                    placeholder={t('settings.trnPlaceholder')}
                  />
                </div>
                <div className="field">
                  <label htmlFor="set-phone">{t('settings.phone')}</label>
                  <input
                    id="set-phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setField('phone', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="set-email">{t('settings.email')}</label>
                  <input
                    id="set-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setField('email', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="set-website">{t('settings.website')}</label>
                  <input
                    id="set-website"
                    type="text"
                    value={form.website}
                    onChange={(e) => setField('website', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="set-city">{t('settings.city')}</label>
                  <input
                    id="set-city"
                    type="text"
                    value={form.city}
                    onChange={(e) => setField('city', e.target.value)}
                  />
                </div>
                <div className="field form-grid__full">
                  <label htmlFor="set-address">{t('settings.address')}</label>
                  <input
                    id="set-address"
                    type="text"
                    value={form.address}
                    onChange={(e) => setField('address', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="set-country">{t('settings.country')}</label>
                  <input
                    id="set-country"
                    type="text"
                    value={form.country}
                    onChange={(e) => setField('country', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="card" aria-label={t('settings.section.invoice')}>
            <div className="card__header">
              <span className="card__icon" aria-hidden="true">
                <Icon name="receipt" />
              </span>
              <h2>{t('settings.section.invoice')}</h2>
            </div>
            <div className="card__body">
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="set-vatRate">{t('settings.vatRate')}</label>
                  <input
                    id="set-vatRate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.vatRate}
                    onChange={(e) => setField('vatRate', e.target.value)}
                    className={vatError ? 'settings-input--error' : ''}
                  />
                  <span className="field__hint">{t('settings.vatRateHint')}</span>
                  {vatError && <span className="field__error">{vatError}</span>}
                </div>
                <div className="field">
                  <label htmlFor="set-invoicePrefix">{t('settings.invoicePrefix')}</label>
                  <input
                    id="set-invoicePrefix"
                    type="text"
                    value={form.invoicePrefix}
                    onChange={(e) => setField('invoicePrefix', e.target.value)}
                  />
                  <span className="field__hint">{t('settings.invoicePrefixHint')}</span>
                </div>
                <div className="field">
                  <label htmlFor="set-currency">{t('settings.currency')}</label>
                  <input
                    id="set-currency"
                    type="text"
                    value={form.currency}
                    onChange={(e) => setField('currency', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="card" aria-label={t('settings.section.payment')}>
            <div className="card__header">
              <span className="card__icon" aria-hidden="true">
                <Icon name="card" />
              </span>
              <h2>{t('settings.section.payment')}</h2>
            </div>
            <div className="card__body">
              <div className="form-grid">
                <div className="field form-grid__full">
                  <label htmlFor="set-terms">{t('settings.terms')}</label>
                  <textarea
                    id="set-terms"
                    rows={4}
                    value={form.terms}
                    onChange={(e) => setField('terms', e.target.value)}
                  />
                  <span className="field__hint">{t('settings.termsHint')}</span>
                </div>
                <div className="field form-grid__full">
                  <label htmlFor="set-bankDetails">{t('settings.bankDetails')}</label>
                  <textarea
                    id="set-bankDetails"
                    rows={4}
                    value={form.bankDetails}
                    onChange={(e) => setField('bankDetails', e.target.value)}
                  />
                  <span className="field__hint">{t('settings.bankDetailsHint')}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="card" aria-label={t('settings.section.backup')}>
            <div className="card__header">
              <span className="card__icon" aria-hidden="true">
                <Icon name="download" />
              </span>
              <h2>{t('settings.section.backup')}</h2>
            </div>
            <div className="card__body">
              <p className="settings-backup__note">{t('settings.backupNote')}</p>
              <div className="settings-backup__actions">
                <button
                  type="button"
                  className="btn btn--neutral"
                  onClick={handleBackup}
                  disabled={backingUp}
                >
                  {backingUp ? <span className="spinner" aria-hidden="true" /> : null}
                  {t('settings.backup')}
                </button>
                <button
                  type="button"
                  className="btn btn--neutral"
                  onClick={() => restoreInputRef.current?.click()}
                  disabled={restoring}
                >
                  {t('settings.restore')}
                </button>
                <input
                  ref={restoreInputRef}
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={handleRestoreFile}
                />
              </div>
            </div>
          </section>
        </div>
      </form>

      <div className="editor-actions settings-actions">
        <button type="submit" form="settings-form" className="btn btn--primary">
          {t('settings.save')}
        </button>
        <button type="button" className="btn btn--neutral" onClick={handleReset}>
          {t('settings.reset')}
        </button>
      </div>

      {/* Two-factor authentication — optional, per user */}
      <section className="card settings-mfa" aria-label={t('settings.mfa.title')}>
        <div className="card__header">
          <span className="card__icon" aria-hidden="true">
            <Icon name="lock" />
          </span>
          <h2>{t('settings.mfa.title')}</h2>
        </div>
        <div className="card__body">
          <p className="fieldset-note">{t('settings.mfa.note')}</p>

          <div className="settings-mfa__status">
            <span className={`settings-mfa__chip ${mfaFactor ? 'is-on' : ''}`}>
              {mfaFactor ? t('settings.mfa.statusOn') : t('settings.mfa.statusOff')}
            </span>

            {mfaFactor ? (
              <button
                type="button"
                className="btn btn--danger btn--sm"
                onClick={mfaDisable}
                disabled={mfaBusy}
              >
                {t('settings.mfa.disable')}
              </button>
            ) : (
              !mfaPending && (
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={mfaEnable}
                  disabled={mfaBusy}
                >
                  {mfaBusy ? <span className="spinner" aria-hidden="true" /> : null}
                  {t('settings.mfa.enable')}
                </button>
              )
            )}
          </div>

          {mfaPending && (
            <div className="settings-mfa__setup">
              <p className="settings-mfa__step">{t('settings.mfa.step1')}</p>
              {mfaPending.qrCode ? (
                <img className="settings-mfa__qr" src={mfaPending.qrCode} alt={t('settings.mfa.qrAlt')} />
              ) : null}
              {mfaPending.secret ? (
                <p className="settings-mfa__secret">
                  {t('settings.mfa.manual')} <code>{mfaPending.secret}</code>
                </p>
              ) : null}

              <form onSubmit={mfaConfirm} className="settings-mfa__form">
                <label htmlFor="mfa-code">{t('settings.mfa.step2')}</label>
                <input
                  ref={mfaCodeRef}
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                />
                <div className="settings-mfa__actions">
                  <button type="button" className="btn btn--neutral btn--sm" onClick={mfaCancel}>
                    {t('common.cancel')}
                  </button>
                  <button type="submit" className="btn btn--primary btn--sm" disabled={mfaBusy}>
                    {mfaBusy ? <span className="spinner" aria-hidden="true" /> : null}
                    {t('settings.mfa.confirm')}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </section>

      {restorePreview && (
        <Modal
          title="settings.restoreTitle"
          onClose={() => setRestorePreview(null)}
          actions={
            <>
              <button
                type="button"
                className="btn btn--neutral"
                onClick={() => setRestorePreview(null)}
                disabled={restoring}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={confirmRestore}
                disabled={restoring}
              >
                {restoring ? <span className="spinner" aria-hidden="true" /> : null}
                {t('settings.restoreConfirm')}
              </button>
            </>
          }
        >
          <p className="settings-backup__note">{t('settings.restorePreviewNote')}</p>
          <ul className="settings-restore__list">
            <li>{t('settings.restoreInvoices', { count: restorePreview.counts.invoices })}</li>
            <li>{t('settings.restoreClients', { count: restorePreview.counts.clients })}</li>
            <li>{t('settings.restoreAgents', { count: restorePreview.counts.agents })}</li>
          </ul>
          <p className="settings-backup__note">{t('settings.restoreSkipNote')}</p>
        </Modal>
      )}
    </div>
  );
}
