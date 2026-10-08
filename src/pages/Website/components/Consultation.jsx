import { useState } from 'react';
import { useLang } from '../../../context/LangContext.jsx';

const CheckIcon = () => (
  <svg viewBox="0 0 28 29" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 1.5C7.65 1.5 2.5 6.65 2.5 13C2.5 19.35 7.65 24.5 14 24.5C20.35 24.5 25.5 19.35 25.5 13C25.5 6.65 20.35 1.5 14 1.5ZM10.5 18.5L5.5 13.5L7.15 11.85L10.5 15.2L16.85 8.85L18.5 10.5L10.5 18.5Z" fill="#D5AF33"/>
  </svg>
);

export default function Consultation() {
  const { t } = useLang();
  const [form, setForm] = useState({
    name: '', phone: '', residence: '', email: '',
    nationality: '', country: '', service: '', details: '', consent: false,
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    alert(t('website.consult.alert'));
    setForm({ name: '', phone: '', residence: '', email: '', nationality: '', country: '', service: '', details: '', consent: false });
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

        <form className="ws-consultation__form" onSubmit={handleSubmit}>
          <h3 className="ws-consultation__form-title">
            {t('website.consult.formTitle')}
          </h3>
          <p className="ws-consultation__form-desc">
            {t('website.consult.formDesc')}
          </p>

          <div className="ws-form-row">
            <div className="ws-form-group">
              <label>{t('website.consult.label.name')}</label>
              <input type="text" name="name" placeholder={t('website.consult.ph.name')} value={form.name} onChange={handleChange} required />
            </div>
            <div className="ws-form-group">
              <label>{t('website.consult.label.email')}</label>
              <input type="email" name="email" placeholder={t('website.consult.ph.email')} value={form.email} onChange={handleChange} required />
            </div>
          </div>

          <div className="ws-form-row">
            <div className="ws-form-group">
              <label>{t('website.consult.label.phone')}</label>
              <input type="tel" name="phone" placeholder={t('website.consult.ph.phone')} value={form.phone} onChange={handleChange} required />
            </div>
            <div className="ws-form-group">
              <label>{t('website.consult.label.nationality')}</label>
              <input type="text" name="nationality" placeholder={t('website.consult.ph.nationality')} value={form.nationality} onChange={handleChange} required />
            </div>
          </div>

          <div className="ws-form-row">
            <div className="ws-form-group">
              <label>{t('website.consult.label.residence')}</label>
              <input type="text" name="residence" placeholder={t('website.consult.ph.residence')} value={form.residence} onChange={handleChange} required />
            </div>
            <div className="ws-form-group">
              <label>{t('website.consult.label.country')}</label>
              <select name="country" value={form.country} onChange={handleChange} required>
                <option value="">{t('website.consult.selectDestination')}</option>
                <option value="albania">{t('website.destinations.d1.name')}</option>
                <option value="kosovo">{t('website.destinations.d2.name')}</option>
                <option value="montenegro">{t('website.destinations.d3.name')}</option>
                <option value="north-macedonia">{t('website.destinations.d4.name')}</option>
                <option value="serbia">{t('website.destinations.d5.name')}</option>
              </select>
            </div>
            <div className="ws-form-group">
              <label>{t('website.consult.label.service')}</label>
              <select name="service" value={form.service} onChange={handleChange} required>
                <option value="">{t('website.consult.selectPathway')}</option>
                <option value="tourist-visa">{t('website.services.s1.title')}</option>
                <option value="investor-residency">{t('website.services.s2.title')}</option>
                <option value="work-contract">{t('website.consult.opt.workContract')}</option>
              </select>
            </div>
          </div>

          <div className="ws-form-group ws-form-group--full">
            <label>{t('website.consult.label.details')}</label>
            <textarea
              name="details"
              placeholder={t('website.consult.ph.details')}
              value={form.details}
              onChange={handleChange}
              rows={4}
              required
            />
          </div>

          <label className="ws-checkbox">
            <input type="checkbox" name="consent" checked={form.consent} onChange={handleChange} required />
            <span>
              {t('website.consult.consent')}
            </span>
          </label>

          <button type="submit" className="ws-btn ws-btn--dark">{t('website.consult.submit')}</button>
        </form>
      </div>
    </section>
  );
}
