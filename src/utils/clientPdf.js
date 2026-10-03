/**
 * Client document generation.
 *
 * The company Letterhead (`src/assets/letterhead.pdf`) is the official template:
 * it is LOADED as-is and only the client data / images are drawn on top of it.
 * Nothing in the template is redrawn, re-styled or recreated.
 *
 * Page size is read from the template itself, so replacing the file with an
 * A4 export requires no code change.
 *
 * Language: English only (Helvetica — the template uses Arial/WinAnsi too).
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
// The template is embedded as a data URI inside this module (see
// scripts/embed-letterhead.mjs, run with `npm run letterhead`), so no network
// request is ever made for it — extensions/ad-blockers cannot block it.
import letterheadAsset from '../assets/letterhead.data.js';
import { statusClass } from '../data/clientStatuses.js';
import { clientFullName, getClientInvoices } from './clients.js';
import { documentBytes, uploadClientPdf, currentUserId } from './uploads.js';

const NAVY = rgb(0.114, 0.208, 0.369);
const GOLD = rgb(0.835, 0.686, 0.204);
const GRAY = rgb(0.431, 0.471, 0.518);
const DARK = rgb(0.11, 0.141, 0.188);
const LINE = rgb(0.839, 0.859, 0.886);
const WHITE = rgb(1, 1, 1);

/** English-only safe text: guaranteed to exist in the Helvetica glyph set. */
function safe(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function docDate(iso) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  if (!m) return safe(iso);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/* ------------------------------ drawing ------------------------------ */

function drawFitted(page, text, opts) {
  const { x, y, maxWidth, size, font, color, align = 'left' } = opts;
  const str = safe(text);
  if (!str) return;
  let current = Math.max(size, 6);
  let width = font.widthOfTextAtSize(str, current);
  while (width > maxWidth && current > 5) {
    current -= 0.5;
    width = font.widthOfTextAtSize(str, current);
  }
  let output = str;
  if (width > maxWidth) {
    output = str;
    while (output.length > 1 && font.widthOfTextAtSize(`${output}...`, current) > maxWidth) {
      output = output.slice(0, -1);
    }
    output = `${output}...`;
    width = font.widthOfTextAtSize(output, current);
  }
  let tx = x;
  if (align === 'right') tx = x - width;
  else if (align === 'center') tx = x - width / 2;
  page.drawText(output, { x: tx, y, size: current, font, color });
}

function drawContained(page, drawable, box) {
  const natural =
    drawable.kind === 'img'
      ? { w: drawable.image.width, h: drawable.image.height }
      : { w: drawable.page.width, h: drawable.page.height };
  if (!natural.w || !natural.h) return;
  const scale = Math.min(box.w / natural.w, box.h / natural.h);
  const w = natural.w * scale;
  const h = natural.h * scale;
  const x = box.x + (box.w - w) / 2;
  const y = box.y + (box.h - h) / 2;
  if (drawable.kind === 'img') {
    page.drawImage(drawable.image, { x, y, width: w, height: h });
  } else {
    page.drawPage(drawable.page, { x, y, width: w, height: h });
  }
}

async function embedFile(pdfDoc, meta) {
  if (!meta || !meta.path) return null;
  try {
    const { bytes, contentType } = await documentBytes(meta.path);
    const isPdf =
      String(contentType).includes('pdf') || /\.pdf$/i.test(meta.path || '');
    if (isPdf) {
      const pages = await pdfDoc.embedPdf(bytes);
      if (!pages.length) return null;
      return { kind: 'pdf', page: pages[0] };
    }
    const isPng =
      String(contentType).includes('png') || /\.png$/i.test(meta.path || '');
    const image = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
    return { kind: 'img', image };
  } catch (err) {
    return null;
  }
}

/* ------------------------------- build ------------------------------- */

const FIELDS = [
  [
    { label: 'NAME', key: 'firstName' },
    { label: 'DATE OF BIRTH', key: 'dateOfBirth', date: true },
  ],
  [
    { label: 'FATHER NAME', key: 'fatherName' },
    { label: 'PLACE OF BIRTH', key: 'placeOfBirth' },
  ],
  [
    { label: 'SURNAME', key: 'surname' },
    { label: 'DATE OF ISSUE', key: 'dateOfIssue', date: true },
  ],
  [
    { label: 'COUNTRY NAME', key: 'country' },
    { label: 'DATE OF EXPIRY', key: 'dateOfExpiry', date: true },
  ],
  [
    { label: 'PASSPORT NO.', key: 'passport' },
    { label: 'ISSUING PLACE', key: 'issuingPlace' },
  ],
  [{ label: 'SEX', key: 'sex' }],
];

/**
 * The template is bundled with the app (inlined as a data URI by Vite), so no
 * network request is made — extensions/ad-blockers cannot block it
 * (net::ERR_BLOCKED_BY_CLIENT) and it also works offline.
 */
async function loadTemplateBytes() {
  const url = String(letterheadAsset);
  if (url.startsWith('data:')) {
    const base64 = url.slice(url.indexOf(',') + 1);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error('Letterhead template not found.');
  return res.arrayBuffer();
}

export async function buildClientPdf(client, invoiceRows) {
  const templateBytes = await loadTemplateBytes();

  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPages()[0];
  if (!page) throw new Error('Letterhead template has no page.');

  const { width, height } = page.getSize();
  const left = 36;
  const right = Math.min(430, width - 60);
  const colGap = 16;
  const colW = (right - left - colGap) / 2;
  const colX = [left, left + colW + colGap];

  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  /** top-based y (0 = page top) -> pdf-lib y (0 = page bottom) */
  const ty = (topY) => height - topY;

  /* ---- title ---- */
  page.drawText('CLIENT APPLICATION FORM', {
    x: left,
    y: ty(172),
    size: 15,
    font: bold,
    color: NAVY,
  });
  page.drawLine({
    start: { x: left, y: ty(181) },
    end: { x: right, y: ty(181) },
    thickness: 1.5,
    color: GOLD,
  });

  /* ---- subtitle: who this file belongs to ---- */
  const today = new Date();
  const stamp = `${String(today.getDate()).padStart(2, '0')}/${String(
    today.getMonth() + 1
  ).padStart(2, '0')}/${today.getFullYear()}`;
  drawFitted(page, clientFullName(client), {
    x: left,
    y: ty(197),
    maxWidth: 285,
    size: 11,
    font: bold,
    color: DARK,
  });
  drawFitted(
    page,
    `FILE ${safe(client.passport || client.id || '—')}   ·   GENERATED ${stamp}`,
    {
      x: left,
      y: ty(212),
      maxWidth: 285,
      size: 8,
      font: regular,
      color: GRAY,
    }
  );

  /* ---- client photo: far right of the sheet, inset from the page edge ---- */
  const photoBox = { w: 99, h: 128, top: 150 };
  const photoX = width - 52 - photoBox.w;
  const photoTop = photoBox.top;
  page.drawRectangle({
    x: photoX,
    y: ty(photoTop + photoBox.h),
    width: photoBox.w,
    height: photoBox.h,
    color: WHITE,
    borderColor: LINE,
    borderWidth: 1,
  });

  const photo = await embedFile(pdfDoc, client.documents?.photo);
  if (photo) {
    drawContained(page, photo, {
      x: photoX + 5,
      y: ty(photoTop + photoBox.h - 5),
      w: photoBox.w - 10,
      h: photoBox.h - 10,
    });
  } else {
    drawFitted(page, 'NO PHOTO', {
      x: photoX + photoBox.w / 2,
      y: ty(photoTop + photoBox.h / 2),
      maxWidth: photoBox.w - 12,
      size: 9,
      font: regular,
      color: GRAY,
      align: 'center',
    });
  }

  /* ---- fields (2 columns x 6 rows) ---- */
  const rowsTop = 255;
  const rowH = 68;

  FIELDS.forEach((row, rowIndex) => {
    const top = rowsTop + rowIndex * rowH;
    row.forEach((field, colIndex) => {
      const x = colX[colIndex];
      const raw = field.date ? docDate(client[field.key]) : client[field.key];
      drawFitted(page, field.label, {
        x,
        y: ty(top + 9),
        maxWidth: colW,
        size: 7.5,
        font: bold,
        color: GRAY,
      });
      drawFitted(page, raw || '—', {
        x,
        y: ty(top + 26),
        maxWidth: colW,
        size: 11,
        font: regular,
        color: DARK,
      });
      page.drawLine({
        start: { x, y: ty(top + 34) },
        end: { x: x + colW, y: ty(top + 34) },
        thickness: 0.4,
        color: LINE,
      });
    });
  });

  return pdfDoc.save();
}

export function clientPdfFilename(client) {
  const name = safe([client.surname, client.firstName].filter(Boolean).join('-'))
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9-]/g, '');
  const number = safe(client.passport || client.id || '').replace(/[^A-Za-z0-9-]/g, '');
  return `AL-BALQAN-CLIENT${number ? `-${number}` : ''}${name ? `-${name}` : ''}.pdf`;
}

export function downloadBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Builds the PDF, stores it in Supabase and returns the storage path. */
export async function generateAndStoreClientPdf(client) {
  const invoiceRows = await getClientInvoices(client.passport);
  const bytes = await buildClientPdf(client, invoiceRows);
  const userId = await currentUserId();
  if (!userId) throw new Error('You are not signed in.');
  const path = await uploadClientPdf(userId, client.id, bytes, clientPdfFilename(client));
  return { bytes, path, filename: clientPdfFilename(client) };
}

export { statusClass };
