import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icons/Icon.jsx';
import { useToast } from '../../components/Toast/ToastProvider.jsx';
import { useLang } from '../../context/LangContext.jsx';
import {
  getSettings,
  saveSettings,
  resetSettings,
  normalizeVatRate,
} from '../../utils/settings.js';
import '../../styles/settings.css';

export default function Settings() {
  const toast = useToast();
  const { t } = useLang();
  const [form, setForm] = useState(() => getSettings());
  const [vatError, setVatError] = useState('');

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
    </div>
  );
}
