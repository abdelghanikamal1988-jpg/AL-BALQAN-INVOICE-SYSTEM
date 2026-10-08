import CustomerSection from '../CustomerSection/CustomerSection.jsx';
import ServiceSection from '../ServiceSection/ServiceSection.jsx';
import PaymentSection from '../PaymentSection/PaymentSection.jsx';
import Icon from '../Icons/Icon.jsx';
import { useLang } from '../../context/LangContext.jsx';

export default function InvoiceForm({
  form,
  errors,
  onChange,
  invoiceNumber,
  issueDateDisplay,
  issueTimeDisplay,
  inputRef,
}) {
  const { t } = useLang();
  return (
    <div className="editor-form">
      <section className="card" aria-label={t('invoice.infoSection')}>
        <div className="card__header">
          <span className="card__icon" aria-hidden="true"><Icon name="receipt" /></span>
          <h2>{t('invoice.infoSection')}</h2>
        </div>
        <div className="card__body">
          <div className="form-grid">
            <div className="field">
              <label htmlFor="invoice-number">{t('invoice.numberLabel')}</label>
              <input
                id="invoice-number"
                type="text"
                value={invoiceNumber}
                readOnly
                aria-describedby="invoice-number-hint"
              />
              <span className="field__hint" id="invoice-number-hint">
                {t('invoice.numberHint')}
              </span>
            </div>
            <div className="field">
              <label htmlFor="issue-date">{t('invoice.issueDate')}</label>
              <input id="issue-date" type="text" value={issueDateDisplay} readOnly />
            </div>
            <div className="field form-grid__full">
              <label htmlFor="issue-time">{t('invoice.issueTime')}</label>
              <input id="issue-time" type="text" value={issueTimeDisplay} readOnly />
            </div>
          </div>
        </div>
      </section>

      <CustomerSection form={form} errors={errors} onChange={onChange} inputRef={inputRef} />

      <ServiceSection form={form} errors={errors} onChange={onChange} />

      <PaymentSection form={form} errors={errors} onChange={onChange} />

      <section className="card" aria-label={t('invoice.notesSection')}>
        <div className="card__header">
          <span className="card__icon" aria-hidden="true"><Icon name="note" /></span>
          <h2>{t('invoice.notesSection')}</h2>
        </div>
        <div className="card__body">
          <div className="field">
            <label htmlFor="notes">{t('invoice.notesLabel')}</label>
            <textarea
              id="notes"
              value={form.notes}
              onChange={(e) => onChange('notes', e.target.value)}
              placeholder={t('invoice.notesPlaceholder')}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
