export default function CustomerSection({ form, errors, onChange, inputRef }) {
  const set = (field) => (e) => onChange(field, e.target.value);

  return (
    <section className="card" aria-label="Customer Information">
      <div className="card__header">
        <span className="card__icon" aria-hidden="true">👤</span>
        <h2>Customer Information</h2>
      </div>
      <div className="card__body">
        <div className="form-grid">
          <div className={`field ${errors.name ? 'field--error' : ''}`}>
            <label htmlFor="customer-name">Customer Full Name *</label>
            <input
              id="customer-name"
              type="text"
              value={form.name}
              onChange={set('name')}
              placeholder="Enter full name"
              autoComplete="name"
              ref={inputRef}
            />
            {errors.name && <span className="field__error">{errors.name}</span>}
          </div>

          <div className="field">
            <label htmlFor="customer-nationality">Nationality</label>
            <input
              id="customer-nationality"
              type="text"
              value={form.nationality}
              onChange={set('nationality')}
              placeholder="e.g. Egypt"
              autoComplete="nationality"
            />
          </div>

          <div className="field">
            <label htmlFor="customer-passport">Passport Number</label>
            <input
              id="customer-passport"
              type="text"
              value={form.passport}
              onChange={set('passport')}
              placeholder="Passport number"
              autoComplete="off"
            />
          </div>

          <div className="field">
            <label htmlFor="customer-phone">Phone Number</label>
            <input
              id="customer-phone"
              type="tel"
              value={form.phone}
              onChange={set('phone')}
              placeholder="e.g. +971 50 000 0000"
              autoComplete="tel"
            />
            {errors.phone && <span className="field__error">{errors.phone}</span>}
          </div>

          <div className="field">
            <label htmlFor="customer-email">Email Address</label>
            <input
              id="customer-email"
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="e.g. name@example.com"
              autoComplete="email"
            />
            {errors.email && <span className="field__error">{errors.email}</span>}
          </div>
        </div>
        <p className="legend">Fields marked with * are required.</p>
      </div>
    </section>
  );
}
