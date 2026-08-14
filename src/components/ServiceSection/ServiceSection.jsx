import services from '../../data/services.js';
import destinations from '../../data/destinations.js';

export default function ServiceSection({ form, errors, onChange }) {
  const selectedService = services.find((s) => s.id === form.service) || null;
  const showResidence = selectedService ? selectedService.showResidenceType : false;

  const set = (field) => (e) => onChange(field, e.target.value);

  return (
    <section className="card" aria-label="Travel & Service">
      <div className="card__header">
        <span className="card__icon" aria-hidden="true">✈️</span>
        <h2>Travel &amp; Service</h2>
      </div>
      <div className="card__body">
        <div className="form-grid">
          <div className={`field ${errors.destination ? 'field--error' : ''}`}>
            <label htmlFor="destination">Destination (Country) *</label>
            <select id="destination" value={form.destination} onChange={set('destination')}>
              <option value="">Select destination…</option>
              {destinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
            {errors.destination && <span className="field__error">{errors.destination}</span>}
          </div>

          <div className={`field ${errors.service ? 'field--error' : ''}`}>
            <label htmlFor="service">Service Type *</label>
            <select id="service" value={form.service} onChange={set('service')}>
              <option value="">Select service…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            {errors.service && <span className="field__error">{errors.service}</span>}
          </div>

          {showResidence && (
            <div className="field">
              <label htmlFor="residence-type">Residence Type</label>
              <input
                id="residence-type"
                type="text"
                value={form.residenceType}
                onChange={set('residenceType')}
                placeholder="e.g. Investor Residence"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
