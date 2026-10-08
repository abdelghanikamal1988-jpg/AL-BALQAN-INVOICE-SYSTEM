import Icon from '../Icons/Icon.jsx';
import { useLang } from '../../context/LangContext.jsx';

export default function CustomerSection({ form, errors, onChange, inputRef }) {
  const { t } = useLang();
  const set = (field) => (e) => onChange(field, e.target.value);

  return (
    <section className="card" aria-label={t('invoice.customerSection')}>
      <div className="card__header">
        <span className="card__icon" aria-hidden="true"><Icon name="user" /></span>
        <h2>{t('invoice.customerSection')}</h2>
      </div>
      <div className="card__body">
        <div className="form-grid">
          <div className={`field ${errors.name ? 'field--error' : ''}`}>
            <label htmlFor="customer-name">{t('invoice.customerNameLabel')}</label>
            <input
              id="customer-name"
              type="text"
              value={form.name}
              onChange={set('name')}
              placeholder={t('invoice.customerNamePlaceholder')}
              autoComplete="name"
              ref={inputRef}
            />
            {errors.name && <span className="field__error">{errors.name}</span>}
          </div>

          <div className={`field ${errors.nationality ? 'field--error' : ''}`}>
            <label htmlFor="customer-nationality">{t('invoice.nationalityLabel')}</label>
            <input
              id="customer-nationality"
              type="text"
              value={form.nationality}
              onChange={set('nationality')}
              placeholder={t('invoice.nationalityPlaceholder')}
              autoComplete="nationality"
            />
            {errors.nationality && <span className="field__error">{errors.nationality}</span>}
          </div>

          <div className={`field ${errors.passport ? 'field--error' : ''}`}>
            <label htmlFor="customer-passport">{t('invoice.passportLabel')}</label>
            <input
              id="customer-passport"
              type="text"
              value={form.passport}
              onChange={set('passport')}
              placeholder={t('invoice.passportPlaceholder')}
              autoComplete="off"
            />
            {errors.passport && <span className="field__error">{errors.passport}</span>}
          </div>

          <div className={`field ${errors.phone ? 'field--error' : ''}`}>
            <label htmlFor="customer-phone">{t('invoice.phoneLabel')}</label>
            <input
              id="customer-phone"
              type="tel"
              value={form.phone}
              onChange={set('phone')}
              placeholder={t('invoice.phonePlaceholder')}
              autoComplete="tel"
            />
            {errors.phone && <span className="field__error">{errors.phone}</span>}
          </div>

          <div className="field">
            <label htmlFor="customer-email">{t('invoice.emailLabel')}</label>
            <input
              id="customer-email"
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder={t('invoice.emailPlaceholder')}
              autoComplete="email"
            />
            {errors.email && <span className="field__error">{errors.email}</span>}
          </div>
        </div>
        <p className="legend">{t('invoice.requiredLegend')}</p>
      </div>
    </section>
  );
}
