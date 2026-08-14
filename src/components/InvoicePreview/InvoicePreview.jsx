import company from '../../data/company.js';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { formatDateShort } from '../../utils/formatDate.js';
import { calculatePayment, statusLabel } from '../../utils/paymentCalculator.js';
import { calculateVat, VAT_MODE, VAT_RATE_LABEL } from '../../utils/vat.js';
import { serviceLabel, destinationLabel } from '../../utils/labels.js';

export default function InvoicePreview({ form, invoiceNumber }) {
  const vat = calculateVat(form.total, form.vatMode);
  const calc = calculatePayment(vat.grandTotal, form.paid);
  const isEmpty =
    !form.name && !form.destination && !form.service && !form.total && !form.paid;

  return (
    <div className="invoice-sheet" aria-label="Invoice preview">
      {isEmpty ? (
        <div className="invoice-sheet--placeholder">
          <p>
            Your invoice preview will appear here
            <br />
            as you type.
          </p>
        </div>
      ) : (
        <div className="invoice">
          <div className="invoice__header">
            <div className="invoice__brand">
              <div className="invoice__logo">
                {company.logo ? (
                  <img src={company.logo} alt={`${company.shortName} logo`} />
                ) : (
                  <span className="invoice__logo-placeholder">AB</span>
                )}
              </div>
              <div className="invoice__brand-info">
                <div className="invoice__company-name">{company.name}</div>
                <div className="invoice__company-tagline">Tourism &amp; Visa Services</div>
                <div className="invoice__company-meta">
                  {company.address}
                  <br />
                  Tel: {company.phone} · {company.email}
                  <br />
                  {company.website} · Commercial License No. {company.licenseNo}
                </div>
              </div>
            </div>

            <div className="invoice__title-block">
              <div className="invoice__title">Invoice</div>
              <div className="invoice__meta-box">
                <div>
                  <strong>Invoice #</strong>
                  <div className="invoice__number">{invoiceNumber}</div>
                </div>
                <div>
                  <strong>Issue Date</strong>
                  <div>{form.issueDateDisplay || formatDateShort()}</div>
                </div>
                {form.issueTimeDisplay && (
                  <div>
                    <strong>Issue Time</strong>
                    <div>{form.issueTimeDisplay}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="invoice__body">
            <div className="invoice__section">
              <div className="invoice__section-title">Customer Information</div>
              <div className="invoice__customer-grid">
                <div className="invoice__customer-item">
                  <strong>Customer Name</strong>
                  <span className="invoice__customer-value-upper">{form.name || '—'}</span>
                </div>
                <div className="invoice__customer-item">
                  <strong>Nationality</strong>
                  <span className="invoice__customer-value-upper">{form.nationality || '—'}</span>
                </div>
                <div className="invoice__customer-item">
                  <strong>Passport Number</strong>
                  <span>{form.passport || '—'}</span>
                </div>
                <div className="invoice__customer-item">
                  <strong>Phone</strong>
                  <span>{form.phone || '—'}</span>
                </div>
                <div className="invoice__customer-item">
                  <strong>Email</strong>
                  <span>{form.email || '—'}</span>
                </div>
                <div className="invoice__customer-item">
                  <strong>Destination</strong>
                  <span>{destinationLabel(form.destination)}</span>
                </div>
              </div>
            </div>

            <div className="invoice__section">
              <div className="invoice__section-title">Service Details</div>
              <div className="invoice__service-line">
                <div className="invoice__service-item">
                  <strong>Service Type</strong>
                  <span>{serviceLabel(form.service)}</span>
                </div>
                {form.residenceType && (
                  <div className="invoice__service-item">
                    <strong>Residence Type</strong>
                    <span>{form.residenceType}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="invoice__section">
              <div className="invoice__section-title">Payment Summary</div>
              <div className="invoice__payment">
                {form.vatMode && form.vatMode !== VAT_MODE.NONE && (
                  <>
                    <div className="invoice__payment-row">
                      <span className="invoice__payment-label">Subtotal</span>
                      <span className="invoice__payment-value">{formatCurrency(vat.subtotal)}</span>
                    </div>
                    <div className="invoice__payment-row">
                      <span className="invoice__payment-label">VAT ({VAT_RATE_LABEL})</span>
                      <span className="invoice__payment-value">{formatCurrency(vat.vat)}</span>
                    </div>
                  </>
                )}
                <div className="invoice__payment-row invoice__payment-row--total">
                  <span className="invoice__payment-label">Total Service</span>
                  <span className="invoice__payment-value">{formatCurrency(vat.grandTotal)}</span>
                </div>
                <div className="invoice__payment-row">
                  <span className="invoice__payment-label">Amount Paid</span>
                  <span className="invoice__payment-value">{formatCurrency(calc.paid)}</span>
                </div>
                <div className="invoice__payment-row invoice__payment-row--remaining">
                  <span className="invoice__payment-label">Remaining Balance</span>
                  <span className="invoice__payment-value">{formatCurrency(calc.remaining)}</span>
                </div>
                <div className="invoice__payment-row">
                  <span className="invoice__payment-label">Status</span>
                  <span className="invoice__payment-value">{statusLabel(calc.status)}</span>
                </div>
              </div>
            </div>

            {form.notes && (
              <div className="invoice__section">
                <div className="invoice__section-title">Notes</div>
                <div className="invoice__notes">{form.notes}</div>
              </div>
            )}
          </div>

          <div className="invoice__footer-area">
            <div className="invoice__signature-stamp">
              <div className="invoice__signature-box">
                <div className="invoice__signature-label">Authorized Signature</div>
                <div className="invoice__signature-line">&nbsp;</div>
              </div>
              <div className="invoice__stamp-box">
                <div className="invoice__signature-label">Company Stamp</div>
              </div>
            </div>
            {company.invoiceDisclaimer && (
              <div className="invoice__disclaimer">{company.invoiceDisclaimer}</div>
            )}
          </div>

          <div className="invoice__footer">
            <span>
              {company.name} · {company.city} · Commercial License No. {company.licenseNo}
            </span>
            <span className="invoice__footer-site">{company.website}</span>
          </div>
        </div>
      )}
    </div>
  );
}
