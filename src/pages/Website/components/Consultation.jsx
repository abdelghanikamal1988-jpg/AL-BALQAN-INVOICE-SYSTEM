import { useState } from 'react';
import { useLang } from '../../../context/LangContext.jsx';
import { supabase } from '../../../lib/supabase.js';
import { filterTextInput, hasArabic } from '../../../utils/textCase.js';

const CheckIcon = () => (
  <svg viewBox="0 0 28 29" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 1.5C7.65 1.5 2.5 6.65 2.5 13C2.5 19.35 7.65 24.5 14 24.5C20.35 24.5 25.5 19.35 25.5 13C25.5 6.65 20.35 1.5 14 1.5ZM10.5 18.5L5.5 13.5L7.15 11.85L10.5 15.2L16.85 8.85L18.5 10.5L10.5 18.5Z" fill="#D5AF33"/>
  </svg>
);

const EMPTY = {
  name: '', phone: '', residence: '', email: '',
  nationality: '', country: '', service: '', details: '', consent: false,
};

/* Free-text fields that travel onto the record — all stored in capitals. */
const TEXT_FIELDS = ['name', 'email', 'phone', 'nationality', 'residence', 'details'];

/* Server error message -> translation key. */
const RPC_ERRORS = {
  consent_required: 'website.consult.errConsent',
  required_fields_missing: 'website.consult.errRequired',
  arabic_not_allowed: 'website.consult.errArabic',
  field_too_long: 'website.consult.errTooLong',
  invalid_email: 'website.consult.errEmail',
  invalid_phone: 'website.consult.errPhone',
  duplicate_phone_24h: 'website.consult.errDuplicate',
};

export default function Consultation() {
  const { t } = useLang();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [state, setState] = useState('idle'); // idle | sending | sent | failed
  const [failureKey, setFailureKey] = useState('website.consult.errSubmit');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const next = type === 'checkbox' ? checked : TEXT_FIELDS.includes(name) ? filterTextInput(value) : value;
    setForm((prev) => ({ ...prev, [name]: next }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const copy = { ...prev };
      delete copy[name];
      return copy;
    });
    if (state === 'sent' || state === 'failed') setState('idle');
  };

  const validate = () => {
    const next = {};
    TEXT_FIELDS.forEach((field) => {
      if (hasArabic(form[field])) next[field] = t('website.consult.errArabic');
    });
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length) {
      setErrors(fieldErrors);
      return;
    }
    if (!supabase) {
      setFailureKey('website.consult.errOffline');
      setState('failed');
      return;
    }

    setState('sending');
    try {
      const { error } = await supabase.rpc('submit_consultation', {
        p_full_name: form.name,
        p_email: form.email,
        p_phone: form.phone,
        p_nationality: form.nationality,
        p_country: form.country,
        p_residence: form.residence,
        p_service: form.service,
        p_details: form.details,
        p_consent: form.consent,
      });
      if (error) {
        setFailureKey(RPC_ERRORS[error.message] || 'website.consult.errSubmit');
        setState('failed');
        return;
      }
      setForm(EMPTY);
      setErrors({});
      setState('sent');
    } catch {
      setFailureKey('website.consult.errSubmit');
      setState('failed');
    }
  };

  return (
    <section className="ws-consultation" id="contact">
      <div className="ws-consultation__inner">
        <div className="ws-consultation__sidebar">
          <h2 className="ws-consultation__sidebar-title">
            {t('website.consult.sidebarTitle')}
          </h2>
          <p className="ws-consultation__sidebar-desc">
            {t('website.consult.sidebarDesc')}
          </p>
          <ul className="ws-consultation__features">
            <li>
              <div className="ws-consultation__feature-icon"><CheckIcon /></div>
              <div>
                <span className="ws-consultation__feature-title">{t('website.consult.f1.title')}</span>
                <span className="ws-consultation__feature-desc">{t('website.consult.f1.desc')}</span>
              </div>
            </li>
            <li>
              <div className="ws-consultation__feature-icon"><CheckIcon /></div>
              <div>
                <span className="ws-consultation__feature-title ws-consultation__feature-title--bold">{t('website.consult.f2.title')}</span>
                <span className="ws-consultation__feature-desc">{t('website.consult.f2.desc')}</span>
              </div>
            </li>
            <li>
              <div className="ws-consultation__feature-icon"><CheckIcon /></div>
              <div>
                <span className="ws-consultation__feature-title">{t('website.consult.f3.title')}</span>
                <span className="ws-consultation__feature-desc">
                  {t('website.consult.f3.desc')}
                  <br />
                  {t('website.consult.f3.phone')}
                </span>
              </div>
            </li>
          </ul>
          <div className="ws-consultation__license">
            <p>{t('website.consult.licenseTitle')}</p>
            <p>{t('website.consult.licenseReg')}</p>
          </div>
        </div>

        <form className="ws-consultation__form" onSubmit={handleSubmit} noValidate>
          <h3 className="ws-consultation__form-title">
            {t('website.consult.formTitle')}
          </h3>
          <p className="ws-consultation__form-desc">
            {t('website.consult.formDesc')}
          </p>

          {state === 'sent' && (
            <p className="ws-form-note ws-form-note--ok" role="status">
              {t('website.consult.alert')}
            </p>
          )}
          {state === 'failed' && (
            <p className="ws-form-note ws-form-note--err" role="alert">
              {t(failureKey)}
            </p>
          )}

          <div className="ws-form-row">
            <div className={`ws-form-group${errors.name ? ' ws-form-group--error' : ''}`}>
              <label>{t('website.consult.label.name')}</label>
              <input type="text" name="name" placeholder={t('website.consult.ph.name')} value={form.name} onChange={handleChange} required />
              {errors.name && <span className="ws-field-error">{errors.name}</span>}
            </div>
            <div className={`ws-form-group${errors.email ? ' ws-form-group--error' : ''}`}>
              <label>{t('website.consult.label.email')}</label>
              <input type="email" name="email" placeholder={t('website.consult.ph.email')} value={form.email} onChange={handleChange} required />
              {errors.email && <span className="ws-field-error">{errors.email}</span>}
            </div>
          </div>

          <div className="ws-form-row">
            <div className={`ws-form-group${errors.phone ? ' ws-form-group--error' : ''}`}>
              <label>{t('website.consult.label.phone')}</label>
              <input type="tel" name="phone" placeholder={t('website.consult.ph.phone')} value={form.phone} onChange={handleChange} required />
              {errors.phone && <span className="ws-field-error">{errors.phone}</span>}
            </div>
            <div className={`ws-form-group${errors.nationality ? ' ws-form-group--error' : ''}`}>
              <label>{t('website.consult.label.nationality')}</label>
              <input type="text" name="nationality" placeholder={t('website.consult.ph.nationality')} value={form.nationality} onChange={handleChange} required />
              {errors.nationality && <span className="ws-field-error">{errors.nationality}</span>}
            </div>
          </div>

          <div className="ws-form-row">
            <div className={`ws-form-group${errors.residence ? ' ws-form-group--error' : ''}`}>
              <label>{t('website.consult.label.residence')}</label>
              <input type="text" name="residence" placeholder={t('website.consult.ph.residence')} value={form.residence} onChange={handleChange} required />
              {errors.residence && <span className="ws-field-error">{errors.residence}</span>}
            </div>
            <div className="ws-form-group">
              <label>{t('website.consult.label.country')}</label>
              <select name="country" value={form.country} onChange={handleChange} required>
                <option value="">{t('website.consult.selectDestination')}</option>
                <option value="ALBANIA">{t('website.destinations.d1.name')}</option>
                <option value="KOSOVO">{t('website.destinations.d2.name')}</option>
                <option value="MONTENEGRO">{t('website.destinations.d3.name')}</option>
                <option value="NORTH MACEDONIA">{t('website.destinations.d4.name')}</option>
                <option value="SERBIA">{t('website.destinations.d5.name')}</option>
              </select>
            </div>
            <div className="ws-form-group">
              <label>{t('website.consult.label.service')}</label>
              <select name="service" value={form.service} onChange={handleChange} required>
                <option value="">{t('website.consult.selectPathway')}</option>
                <option value="TOURIST VISA">{t('website.services.s1.title')}</option>
                <option value="INVESTOR RESIDENCY">{t('website.services.s2.title')}</option>
                <option value="WORK CONTRACT & RESIDENCY">{t('website.consult.opt.workContract')}</option>
              </select>
            </div>
          </div>

          <div className={`ws-form-group ws-form-group--full${errors.details ? ' ws-form-group--error' : ''}`}>
            <label>{t('website.consult.label.details')}</label>
            <textarea
              name="details"
              placeholder={t('website.consult.ph.details')}
              value={form.details}
              onChange={handleChange}
              rows={4}
              required
            />
            {errors.details && <span className="ws-field-error">{errors.details}</span>}
          </div>

          <label className="ws-checkbox">
            <input type="checkbox" name="consent" checked={form.consent} onChange={handleChange} required />
            <span>
              {t('website.consult.consent')}
            </span>
          </label>
          {errors.consent && <span className="ws-field-error">{errors.consent}</span>}

          <button
            type="submit"
            className="ws-btn ws-btn--dark"
            disabled={state === 'sending'}
          >
            {state === 'sending' ? t('website.consult.submitting') : t('website.consult.submit')}
          </button>
        </form>
      </div>
    </section>
  );
}
