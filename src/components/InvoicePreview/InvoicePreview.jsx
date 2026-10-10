import { getCompany, getSettings } from '../../utils/settings.js';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { formatDateShort } from '../../utils/formatDate.js';
import { calculatePayment } from '../../utils/paymentCalculator.js';
import { calculateVat, VAT_MODE, vatRateLabel } from '../../utils/vat.js';
import { useLang } from '../../context/LangContext.jsx';

export default function InvoicePreview({ form, invoiceNumber }) {
  const { t } = useLang();
  const company = getCompany();
  const settings = getSettings();
  const vat = calculateVat(form.total, form.vatMode);
  const calc = calculatePayment(vat.grandTotal, form.paid);
  const isEmpty =
    !form.name && !form.destination && !form.service && !form.total && !form.paid;

  return (
    <div className="invoice-sheet" aria-label={t('invoice.previewAria')}>
      {isEmpty ? (
        <div className="invoice-sheet--placeholder">
          <p>
            {t('invoice.previewPlaceholderLine1')}
            <br />
            {t('invoice.previewPlaceholderLine2')}
          </p>
        </div>
      ) : (
        <div className="invoice">
          <div className="invoice__header">
            <div className="invoice__brand">
              <div className="invoice__logo">
                {company.logo ? (
                  <img src={company.logo} alt={t('invoice.logoAlt', { name: company.shortName })} />
                ) : (
                  <span className="invoice__logo-placeholder">AB</span>
                )}
              </div>
              <div className="invoice__brand-info">
                <div className="invoice__company-name">{company.name}</div>
                <div className="invoice__company-tagline">{t('invoice.tagline')}</div>
                <div className="invoice__company-meta">
                  {company.address}
                  <br />
                  {t('invoice.tel')} {company.phone} · {company.email}
                  <br />
                  {company.website} · {t('invoice.licenseNo')} {company.licenseNo}
                  {company.trn ? <> · {t('invoice.trn')} {company.trn}</> : null}
                </div>
              </div>
            </div>

            <div className="invoice__title-block">
              <div className="invoice__title">{t('invoice.docTitle')}</div>
              <div className="invoice__meta-box">
                <div>
                  <strong>{t('invoice.invoiceHash')}</strong>
                  <div className="invoice__number">{invoiceNumber}</div>
                </div>
                <div>
                  <strong>{t('invoice.issueDate')}</strong>
                  <div>{form.issueDateDisplay || formatDateShort()}</div>
                </div>
                {form.issueTimeDisplay && (
                  <div>
                    <strong>{t('invoice.issueTime')}</strong>
                    <div>{form.issueTimeDisplay}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="invoice__body">
            <div className="invoice__section">
              <div className="invoice__section-title">{t('invoice.customerSection')}</div>
              <div className="invoice__customer-grid">
                <div className="invoice__customer-item">
                  <strong>{t('invoice.customerName')}</strong>
                  <span className="invoice__customer-value-upper">{form.name || '—'}</span>
                </div>
                <div className="invoice__customer-item">
                  <strong>{t('invoice.nationality')}</strong>
                  <span className="invoice__customer-value-upper">{form.nationality || '—'}</span>
                </div>
                <div className="invoice__customer-item">
                  <strong>{t('invoice.passport')}</strong>
                  <span className="invoice__customer-value-upper">{form.passport || '—'}</span>
                </div>
                <div className="invoice__customer-item">
                  <strong>{t('invoice.phone')}</strong>
                  <span className="invoice__customer-value-upper">{form.phone || '—'}</span>
                </div>
                <div className="invoice__customer-item">
                  <strong>{t('invoice.email')}</strong>
                  <span>{form.email || '—'}</span>
                </div>
                <div className="invoice__customer-item">
                  <strong>{t('invoice.destination')}</strong>
                  <span>{form.destination ? t('data.destination.' + form.destination) : '—'}</span>
                </div>
              </div>
            </div>

            <div className="invoice__section">
              <div className="invoice__section-title">{t('invoice.serviceDetails')}</div>
              <div className="invoice__service-line">
                <div className="invoice__service-item">
                  <strong>{t('invoice.serviceType')}</strong>
                  <span>{form.service ? t('data.service.' + form.service) : '—'}</span>
                </div>
                {form.residenceType && (
                  <div className="invoice__service-item">
                    <strong>{t('invoice.residenceTypeLabel')}</strong>
                    <span>{form.residenceType}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="invoice__section">
              <div className="invoice__section-title">{t('invoice.paymentSummary')}</div>
              <div className="invoice__payment">
                {form.vatMode && form.vatMode !== VAT_MODE.NONE && (
                  <>
                    <div className="invoice__payment-row">
                      <span className="invoice__payment-label">{t('invoice.subtotal')}</span>
                      <span className="invoice__payment-value">{formatCurrency(vat.subtotal)}</span>
                    </div>
                    <div className="invoice__payment-row">
                      <span className="invoice__payment-label">{t('invoice.vatRate', { rate: vatRateLabel(vat.rate) })}</span>
                      <span className="invoice__payment-value">{formatCurrency(vat.vat)}</span>
                    </div>
                  </>
                )}
                <div className="invoice__payment-row invoice__payment-row--total">
                  <span className="invoice__payment-label">{t('invoice.totalService')}</span>
                  <span className="invoice__payment-value">{formatCurrency(vat.grandTotal)}</span>
                </div>
                <div className="invoice__payment-row">
                  <span className="invoice__payment-label">{t('invoice.amountPaid')}</span>
                  <span className="invoice__payment-value">{formatCurrency(calc.paid)}</span>
                </div>
                <div className="invoice__payment-row invoice__payment-row--remaining">
                  <span className="invoice__payment-label">{t('invoice.remainingBalance')}</span>
                  <span className="invoice__payment-value">{formatCurrency(calc.remaining)}</span>
                </div>
                <div className="invoice__payment-row">
                  <span className="invoice__payment-label">{t('common.status')}</span>
                  <span className="invoice__payment-value">{t('invoice.status.' + calc.status)}</span>
                </div>
              </div>
            </div>

            {form.notes && (
              <div className="invoice__section">
                <div className="invoice__section-title">{t('invoice.notesSection')}</div>
                <div className="invoice__notes">{form.notes}</div>
              </div>
            )}

            {settings.terms && (
              <div className="invoice__section">
                <div className="invoice__section-title">{t('invoice.termsSection')}</div>
                <div className="invoice__notes">{settings.terms}</div>
              </div>
            )}

            {settings.bankDetails && (
              <div className="invoice__section">
                <div className="invoice__section-title">{t('invoice.bankSection')}</div>
                <div className="invoice__notes">{settings.bankDetails}</div>
              </div>
            )}
          </div>

          <div className="invoice__footer-area">
            <div className="invoice__signature-stamp">
              <div className="invoice__signature-box">
                <div className="invoice__signature-label">{t('invoice.signature')}</div>
                <div className="invoice__signature-line">&nbsp;</div>
              </div>
              <div className="invoice__stamp-box">
                <div className="invoice__signature-label">{t('invoice.companyStamp')}</div>
              </div>
            </div>
            {company.invoiceDisclaimer && (
              <div className="invoice__disclaimer">{company.invoiceDisclaimer}</div>
            )}
          </div>

          <div className="invoice__footer">
            <span>
              {company.name} · {company.city} · {t('invoice.licenseNo')} {company.licenseNo}
            </span>
            <span className="invoice__footer-site">{company.website}</span>
          </div>
        </div>
      )}
    </div>
  );
}
