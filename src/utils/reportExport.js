/**
 * Dashboard monthly report export — CSV and a branded A4 PDF.
 *
 * The dashboard already shows the numbers (invoices per month, invoiced vs
 * paid, client pipeline) but had no way to hand them to accounting or
 * management. This module turns the same series the charts use into a file
 * you can download, reusing the jsPDF engine the invoice export uses (loaded
 * dynamically so it never slows the first paint).
 *
 * Arabic text is routed through pdfSafeText so the PDF keeps the standard
 * Latin subset the invoice export already relies on.
 */

import { formatCurrency } from './formatCurrency.js';
import { pdfSafeText } from './arabicLatin.js';

const INK = [20, 20, 20];
const GOLD = [213, 175, 52];
const GRAY = [110, 110, 110];
const LIGHT = [245, 245, 245];

const A4_W = 210;
const A4_H = 297;
const M = 14;
const CW = A4_W - M * 2;

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRow(cells) {
  return cells.map(csvCell).join(',');
}

/** Monthly series + totals as a CSV string (BOM added at download time). */
export function buildReportCsv({ monthSeries, financials, clientStats, coverage }) {
  const lines = [];
  lines.push(csvRow(['Month', 'Invoices', 'Invoiced', 'Paid']));
  let totalInv = 0;
  let totalRevenue = 0;
  let totalPaid = 0;
  (monthSeries || []).forEach((b) => {
    totalInv += b.count || 0;
    totalRevenue += b.revenue || 0;
    totalPaid += b.paid || 0;
    lines.push(csvRow([b.label, b.count || 0, round2(b.revenue), round2(b.paid)]));
  });
  lines.push(csvRow(['TOTAL', totalInv, round2(totalRevenue), round2(totalPaid)]));
  lines.push('');
  lines.push(csvRow(['Summary', 'Value']));
  lines.push(csvRow(['Total invoiced', round2(financials.invoiced)]));
  lines.push(csvRow(['Total paid', round2(financials.paid)]));
  lines.push(csvRow(['Outstanding', round2(financials.remaining)]));
  lines.push(csvRow(['Partially paid invoices', financials.partiallyPaid || 0]));
  lines.push('');
  lines.push(csvRow(['Clients', 'Value']));
  lines.push(csvRow(['Total clients', clientStats.total]));
  lines.push(csvRow(['New', clientStats.fresh]));
  lines.push(csvRow(['Under review', clientStats.review]));
  lines.push(csvRow(['Approved', clientStats.approved]));
  lines.push(csvRow(['Rejected', clientStats.rejected]));
  if (coverage) {
    lines.push('');
    lines.push(csvRow(['Invoice coverage', 'Value']));
    lines.push(csvRow(['Clients with an invoice', coverage.withInvoice]));
    lines.push(csvRow(['Clients without an invoice', coverage.without]));
  }
  return lines.join('\r\n');
}

/** Downloads the monthly report as CSV. */
export function exportReportCsv(data) {
  const blob = new Blob([String.fromCharCode(0xfeff) + buildReportCsv(data)], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `albalqan-report-${stamp()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function loadJsPdf() {
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await import('jspdf');
    } catch (err) {
      lastErr = err;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  console.error('[report] jsPDF failed to load', lastErr);
  const err = new Error('pdf-engine-load');
  err.code = 'PDF_ENGINE_LOAD';
  throw err;
}

/**
 * Builds the monthly report PDF and returns the jsPDF instance so callers
 * can save it.
 */
export async function buildReportPdf({ monthSeries, financials, clientStats, coverage }) {
  const { jsPDF } = await loadJsPdf();
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

  let y = M;

  /* Branding bar. */
  pdf.setFillColor(...INK);
  pdf.rect(0, 0, A4_W, 26, 'F');
  pdf.setFillColor(...GOLD);
  pdf.rect(0, 26, A4_W, 1.4, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text('AL BALQAN', M, 13);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(210, 210, 210);
  pdf.text('Tourism & Visa Services - Monthly Report', M, 20);
  pdf.setFontSize(9);
  pdf.text(stamp(), A4_W - M, 20, { align: 'right' });
  y = 38;

  const sectionTitle = (label) => {
    pdf.setTextColor(...INK);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text(pdfSafeText(label), M, y);
    y += 2;
    pdf.setDrawColor(...GOLD);
    pdf.setLineWidth(0.6);
    pdf.line(M, y, A4_W - M, y);
    y += 6;
  };

  const table = (headers, rows, aligns) => {
    const cols = headers.length;
    const colW = CW / cols;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setFillColor(...LIGHT);
    pdf.rect(M, y, CW, 7, 'F');
    pdf.setTextColor(...INK);
    headers.forEach((h, i) => {
      const x = M + colW * i + (aligns[i] === 'right' ? colW - 2 : 2);
      pdf.text(
        pdfSafeText(h),
        x,
        y + 4.8,
        aligns[i] === 'right' ? { align: 'right' } : undefined,
      );
    });
    y += 7;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    rows.forEach((r) => {
      r.forEach((cell, i) => {
        const x = M + colW * i + (aligns[i] === 'right' ? colW - 2 : 2);
        pdf.setTextColor(...GRAY);
        pdf.text(
          pdfSafeText(cell),
          x,
          y + 4.8,
          aligns[i] === 'right' ? { align: 'right' } : undefined,
        );
      });
      y += 6.6;
    });
    y += 3;
  };

  sectionTitle('Invoices per month');
  let totalInv = 0;
  let totalRevenue = 0;
  let totalPaid = 0;
  (monthSeries || []).forEach((b) => {
    totalInv += b.count || 0;
    totalRevenue += b.revenue || 0;
    totalPaid += b.paid || 0;
  });
  table(
    ['Month', 'Invoices', 'Invoiced', 'Paid'],
    (monthSeries || []).map((b) => [
      b.label,
      String(b.count || 0),
      formatCurrency(b.revenue),
      formatCurrency(b.paid),
    ]),
    ['left', 'right', 'right', 'right'],
  );

  sectionTitle('Totals');
  table(
    ['Metric', 'Value'],
    [
      ['Total invoiced', formatCurrency(financials.invoiced)],
      ['Total paid', formatCurrency(financials.paid)],
      ['Outstanding', formatCurrency(financials.remaining)],
      ['Partially paid invoices', String(financials.partiallyPaid || 0)],
    ],
    ['left', 'right'],
  );

  sectionTitle('Client pipeline');
  const clientRows = [
    ['Total clients', String(clientStats.total)],
    ['New', String(clientStats.fresh)],
    ['Under review', String(clientStats.review)],
    ['Approved', String(clientStats.approved)],
    ['Rejected', String(clientStats.rejected)],
  ];
  if (coverage) {
    clientRows.push(['Clients with an invoice', String(coverage.withInvoice)]);
    clientRows.push(['Clients without an invoice', String(coverage.without)]);
  }
  table(['Metric', 'Value'], clientRows, ['left', 'right']);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  pdf.text('AL BALQAN - generated by the invoice system', M, A4_H - 10);

  return pdf;
}

/** Downloads the monthly report as a branded PDF. */
export async function exportReportPdf(data) {
  const pdf = await buildReportPdf(data);
  pdf.save(`albalqan-report-${stamp()}.pdf`);
}
