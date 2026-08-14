import CustomerSection from '../CustomerSection/CustomerSection.jsx';
import ServiceSection from '../ServiceSection/ServiceSection.jsx';
import PaymentSection from '../PaymentSection/PaymentSection.jsx';

export default function InvoiceForm({
  form,
  errors,
  onChange,
  invoiceNumber,
  issueDateDisplay,
  issueTimeDisplay,
  inputRef,
}) {
  return (
    <div className="editor-form">
      <section className="card" aria-label="Invoice Information">
        <div className="card__header">
          <span className="card__icon" aria-hidden="true">🧾</span>
          <h2>Invoice Information</h2>
        </div>
        <div className="card__body">
          <div className="form-grid">
            <div className="field">
              <label htmlFor="invoice-number">Invoice Number</label>
              <input
                id="invoice-number"
                type="text"
                value={invoiceNumber}
                readOnly
                aria-describedby="invoice-number-hint"
              />
              <span className="field__hint" id="invoice-number-hint">
                Generated automatically.
              </span>
            </div>
            <div className="field">
              <label htmlFor="issue-date">Issue Date</label>
              <input id="issue-date" type="text" value={issueDateDisplay} readOnly />
            </div>
            <div className="field form-grid__full">
              <label htmlFor="issue-time">Issue Time</label>
              <input id="issue-time" type="text" value={issueTimeDisplay} readOnly />
            </div>
          </div>
        </div>
      </section>

      <CustomerSection form={form} errors={errors} onChange={onChange} inputRef={inputRef} />

      <ServiceSection form={form} errors={errors} onChange={onChange} />

      <PaymentSection form={form} errors={errors} onChange={onChange} />

      <section className="card" aria-label="Notes">
        <div className="card__header">
          <span className="card__icon" aria-hidden="true">📝</span>
          <h2>Notes</h2>
        </div>
        <div className="card__body">
          <div className="field">
            <label htmlFor="notes">Notes (optional)</label>
            <textarea
              id="notes"
              value={form.notes}
              onChange={(e) => onChange('notes', e.target.value)}
              placeholder="Add any notes to appear on the invoice…"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
