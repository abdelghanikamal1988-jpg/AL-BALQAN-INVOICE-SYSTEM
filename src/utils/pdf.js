/**
 * PDF export — generated directly with jsPDF (vector drawing).
 *
 * The invoice is drawn as A4 with the AL BALQAN branding and the same
 * layout as the on-screen preview. No DOM capture is involved, which makes
 * it reliable in every modern browser.
 *
 * jsPDF is loaded dynamically so it does not slow down the initial page load.
 */

import company from '../data/company.js';
import { sanitizeFilenamePart } from './validation.js';
import { calculatePayment, statusLabel } from './paymentCalculator.js';
import { formatCurrency } from './formatCurrency.js';
import { serviceLabel, destinationLabel } from './labels.js';
import { invoicePaymentBreakdown, VAT_MODE, VAT_RATE_LABEL } from './vat.js';

const NAVY = [29, 53, 94];
const GOLD = [213, 175, 52];
const GRAY = [110, 120, 132];
const DARK = [28, 36, 48];
const LIGHT = [245, 246, 248];
const GOLD_BG = [255, 248, 230];

const A4_W = 210;
const A4_H = 297;
const M = 14; // margin
const CW = A4_W - M * 2; // content width

export function pdfFilename(invoice) {
  const customer = sanitizeFilenamePart(invoice.customer?.name || '');
  return `AL-BALQAN-${sanitizeFilenamePart(invoice.invoiceNumber)}${
    customer ? `-${customer.replace(/\s+/g, '-')}` : ''
  }.pdf`;
}

function loadLogo() {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = company.logo;
  });
}

function logoDataUrl(img) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || 300;
    canvas.height = img.naturalHeight || 300;
    canvas.getContext('2d').drawImage(img, 0, 0);
    return canvas.toDataURL('image/png');
  } catch (err) {
    return null;
  }
}

export async function exportInvoicePdf(invoice) {
  const pdf = await buildInvoicePdf(invoice);
  pdf.save(pdfFilename(invoice));
}

/**
 * Builds the invoice PDF (shared by export and print) and returns the jsPDF
 * instance so callers can save it or print it.
 */
export async function buildInvoicePdf(invoice) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

  const payment = invoicePaymentBreakdown(invoice.payment);
  const calc = calculatePayment(payment.grandTotal, payment.paid);
  const hasVat = payment.vat > 0;

  /* ---------- helpers ---------- */

  const text = (str, x, y, { size = 9, style = 'normal', color = DARK, align = 'left' } = {}) => {
    pdf.setFont('helvetica', style);
    pdf.setFontSize(size);
    pdf.setTextColor(color[0], color[1], color[2]);
    pdf.text(str, x, y, { align });
  };

  const wrap = (str, x, y, maxWidth, { size = 9, style = 'normal', color = DARK } = {}) => {
    pdf.setFont('helvetica', style);
    pdf.setFontSize(size);
    pdf.setTextColor(color[0], color[1], color[2]);
    const lines = pdf.splitTextToSize(str || '', maxWidth);
    pdf.text(lines, x, y);
    return lines.length;
  };

  const sectionTitle = (label, y) => {
    text(label, M, y, { size: 7, style: 'bold', color: NAVY });
    pdf.setDrawColor(...NAVY);
    pdf.setLineWidth(0.25);
    pdf.line(M, y + 1.6, A4_W - M, y + 1.6);
  };

  const item = (label, value, x, y, maxW) => {
    text(label, x, y, { size: 6, style: 'bold', color: GRAY });
    const lines = wrap(value || '—', x, y + 3.4, maxW, { size: 8.5, style: 'normal', color: DARK });
    return y + 3.4 + Math.max(lines - 1, 0) * 4;
  };

  const caps = (value) => (value ? String(value).toUpperCase() : value);

  /* ---------- header ---------- */

  let y = 15;

  // Logo (contained in a 32mm box, keeping proportions)
  const img = await loadLogo();
  const dataUrl = img ? logoDataUrl(img) : null;
  const logoBox = 32;
  if (dataUrl) {
    const ratio = (img.naturalWidth || 1) / (img.naturalHeight || 1);
    let w = logoBox;
    let h = logoBox;
    if (ratio > 1) h = logoBox / ratio;
    else w = logoBox * ratio;
    const ox = M + (logoBox - w) / 2;
    const oy = y + (logoBox - h) / 2;
    pdf.addImage(dataUrl, 'PNG', ox, oy, w, h);
  } else {
    pdf.setFillColor(...NAVY);
    pdf.roundedRect(M, y, logoBox, logoBox, 2, 2, 'F');
    text('AB', M + logoBox / 2, y + logoBox / 2 + 1.5, { size: 13, style: 'bold', color: [255, 255, 255], align: 'center' });
  }

  // Company info
  text(company.name, M + logoBox + 6, y + 4, { size: 12, style: 'bold', color: NAVY });
  text('TOURISM & VISA SERVICES', M + logoBox + 6, y + 8.5, { size: 7, style: 'bold', color: GRAY });
  const addrLines = wrap(company.address, M + logoBox + 6, y + 13, 95, { size: 7.5, color: GRAY });
  let infoY = y + 13 + (addrLines - 1) * 3.4;
  text(`Tel: ${company.phone}  ·  ${company.email}`, M + logoBox + 6, infoY + 4, { size: 7.5, color: GRAY });
  text(`${company.website}  ·  Commercial License No. ${company.licenseNo}`, M + logoBox + 6, infoY + 8, { size: 7.5, color: GRAY });

  // Invoice title + meta (right)
  text('INVOICE', A4_W - M, y + 4, { size: 20, style: 'bold', color: NAVY, align: 'right' });
  pdf.setDrawColor(...GOLD);
  pdf.setLineWidth(1);
  pdf.line(A4_W - M - 46, y + 6.5, A4_W - M, y + 6.5);

  pdf.setFillColor(...LIGHT);
  pdf.setDrawColor(210, 214, 220);
  pdf.setLineWidth(0.2);
  pdf.roundedRect(A4_W - M - 62, y + 10, 62, 24, 1.2, 1.2, 'FD');

  text('INVOICE #', A4_W - M - 58, y + 15, { size: 6, style: 'bold', color: GRAY });
  text(invoice.invoiceNumber || '—', A4_W - M - 58, y + 19.5, { size: 10, style: 'bold', color: NAVY });
  text(`Issue Date: ${invoice.issueDate || '—'}`, A4_W - M - 58, y + 26, { size: 7.5, color: DARK });
  if (invoice.issueTime) {
    text(`Issue Time: ${invoice.issueTime}`, A4_W - M - 58, y + 30.5, { size: 7.5, color: DARK });
  }

  y = 15 + logoBox + 8;

  // Divider
  pdf.setFillColor(...NAVY);
  pdf.rect(M, y, CW, 1.3, 'F');
  y += 8;

  /* ---------- customer ---------- */

  sectionTitle('Customer Information', y);
  y += 7.5;

  const colW = (CW - 6) / 2;
  let rowY = y;
  rowY = item('Customer Name', caps(invoice.customer?.name), M, rowY, colW);
  rowY = item('Nationality', caps(invoice.customer?.nationality), M + colW + 6, rowY, colW);
  rowY = item('Passport Number', invoice.customer?.passport, M, rowY + 2, colW);
  rowY = item('Phone', invoice.customer?.phone, M + colW + 6, rowY + 2, colW);
  rowY = item('Email', invoice.customer?.email, M, rowY + 2, colW);
  rowY = item('Destination', destinationLabel(invoice.travel?.destination), M + colW + 6, rowY + 2, colW);

  y = rowY + 8;

  /* ---------- service ---------- */

  sectionTitle('Service Details', y);
  y += 7.5;

  item('Service Type', serviceLabel(invoice.travel?.service), M, y, colW);
  if (invoice.travel?.residenceType) {
    item('Residence Type', invoice.travel.residenceType, M + colW + 6, y, colW);
  }
  y += 12;

  /* ---------- payment ---------- */

  sectionTitle('Payment Summary', y);
  y += 7.5;

  const payRow = (label, value, optY, { fill = null, valueSize = 11, valueColor = DARK, labelColor = GRAY } = {}) => {
    const rowH = optY;
    if (fill) {
      pdf.setFillColor(fill[0], fill[1], fill[2]);
      pdf.roundedRect(M, optY, CW, 9.5, 1, 1, 'F');
    } else {
      pdf.setDrawColor(220, 224, 230);
      pdf.setLineWidth(0.2);
      pdf.roundedRect(M, optY, CW, 9.5, 1, 1, 'S');
    }
    text(label, M + 5, optY + 6.2, { size: 7.5, style: 'bold', color: labelColor });
    text(value, A4_W - M - 5, optY + 6.2, { size: valueSize, style: 'bold', color: valueColor, align: 'right' });
    return optY + 9.5 + 1.2;
  };

  if (hasVat) {
    y = payRow('SUBTOTAL', formatCurrency(payment.subtotal), y);
    y = payRow(`VAT (${VAT_RATE_LABEL})`, formatCurrency(payment.vat), y);
  }
  y = payRow('TOTAL', formatCurrency(payment.grandTotal), y, { fill: NAVY, valueColor: [255, 255, 255], labelColor: [255, 255, 255] });
  y = payRow('AMOUNT PAID', formatCurrency(calc.paid), y);
  y = payRow('REMAINING BALANCE', formatCurrency(calc.remaining), y, { fill: GOLD_BG, valueColor: NAVY, labelColor: NAVY });
  y = payRow('STATUS', statusLabel(calc.status), y);

  /* ---------- notes ---------- */

  if (invoice.notes) {
    y += 3;
    sectionTitle('Notes', y);
    y += 7.5;
    y += (wrap(invoice.notes, M, y, CW, { size: 8.5, color: GRAY }) - 1) * 3.8 + 4;
  }

  /* ---------- signature & stamp ---------- */

  const sigY = Math.max(y + 6, 232);

  text('Authorized Signature', M, sigY, { size: 7, style: 'bold', color: GRAY });
  pdf.setDrawColor(150, 158, 168);
  pdf.setLineWidth(0.3);
  pdf.line(M, sigY + 4, M + 78, sigY + 4);
  text('Signature', M, sigY + 9.5, { size: 7, color: GRAY });

  text('Company Stamp', A4_W - M - 55, sigY, { size: 7, style: 'bold', color: GRAY, align: 'right' });
  pdf.setLineWidth(0.25);
  pdf.line(A4_W - M - 55, sigY + 4, A4_W - M, sigY + 4);

  /* ---------- disclaimer ---------- */

  const discY = A4_H - 24;
  if (company.invoiceDisclaimer) {
    pdf.setDrawColor(210, 214, 220);
    pdf.setLineWidth(0.2);
    pdf.line(M, discY - 4, A4_W - M, discY - 4);
    const lines = wrap(company.invoiceDisclaimer, M, discY, CW, { size: 6.5, color: GRAY });
    void lines;
  }

  /* ---------- footer ---------- */

  pdf.setFillColor(...NAVY);
  pdf.rect(0, A4_H - 14, A4_W, 14, 'F');
  text(
    `${company.name} · ${company.city} · Commercial License No. ${company.licenseNo}`,
    M,
    A4_H - 6.5,
    { size: 7, style: 'normal', color: [255, 255, 255] }
  );
  text(company.website, A4_W - M, A4_H - 6.5, { size: 7.5, style: 'bold', color: GOLD, align: 'right' });

  return pdf;
}

/**
 * Opens the browser's print dialog for the generated PDF in a new tab.
 * The printed result is pixel-identical to the exported PDF.
 */
export async function printInvoicePdf(invoice) {
  const pdf = await buildInvoicePdf(invoice);
  pdf.autoPrint();
  const url = pdf.output('bloburl');
  const win = window.open(url, '_blank');
  if (!win) {
    pdf.save(pdfFilename(invoice));
    throw new Error('popup-blocked');
  }
  return win;
}
