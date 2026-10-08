import services from '../../data/services.js';
import destinations from '../../data/destinations.js';
import Icon from '../Icons/Icon.jsx';
import { useLang } from '../../context/LangContext.jsx';

export default function ServiceSection({ form, errors, onChange }) {
  const { t } = useLang();
  const selectedService = services.find((s) => s.id === form.service) || null;
  const showResidence = selectedService ? selectedService.showResidenceType : false;

  const set = (field) => (e) => onChange(field, e.target.value);

  return (
    <section className="card" aria-label={t('invoice.travelService')}>
      <div className="card__header">
        <span className="card__icon" aria-hidden="true"><Icon name="plane" /></span>
        <h2>{t('invoice.travelService')}</h2>
      </div>
      <div className="card__body">
        <div className="form-grid">
          <div className={`field ${errors.destination ? 'field--error' : ''}`}>
            <label htmlFor="destination">{t('invoice.destinationLabel')}</label>
            <select id="destination" value={form.destination} onChange={set('destination')}>
              <option value="">{t('invoice.selectDestination')}</option>
              {destinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {t('data.destination.' + d.id)}
                </option>
              ))}
            </select>
            {errors.destination && <span className="field__error">{errors.destination}</span>}
          </div>

          <div className={`field ${errors.service ? 'field--error' : ''}`}>
            <label htmlFor="service">{t('invoice.serviceTypeLabel')}</label>
            <select id="service" value={form.service} onChange={set('service')}>
              <option value="">{t('invoice.selectService')}</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {t('data.service.' + s.id)}
                </option>
              ))}
            </select>
            {errors.service && <span className="field__error">{errors.service}</span>}
          </div>

          {showResidence && (
            <div className="field">
              <label htmlFor="residence-type">{t('invoice.residenceTypeLabel')}</label>
              <input
                id="residence-type"
                type="text"
                value={form.residenceType}
                onChange={set('residenceType')}
                placeholder={t('invoice.residencePlaceholder')}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
