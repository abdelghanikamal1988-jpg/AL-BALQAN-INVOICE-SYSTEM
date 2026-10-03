/**
 * Dev-only visual harness: replays the exact drawing code from
 * src/utils/clientPdf.js on public/letterhead.pdf and writes .dev/out.pdf.
 * Never bundled â€” .dev is outside the vite entry graph.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const NAVY = rgb(0.114, 0.208, 0.369);
const GOLD = rgb(0.835, 0.686, 0.204);
const GRAY = rgb(0.431, 0.471, 0.518);
const DARK = rgb(0.11, 0.141, 0.188);
const LINE = rgb(0.839, 0.859, 0.886);
const WHITE = rgb(1, 1, 1);

const STATUS_COLORS = {
  APPROVED: rgb(0.114, 0.478, 0.267),
  REJECTED: rgb(0.702, 0.149, 0.149),
};

function safe(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clientFullName(client) {
  return [client?.firstName, client?.fatherName, client?.surname]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function docDate(iso) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  if (!m) return safe(iso);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

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
  if (drawable.kind === 'img') page.drawImage(drawable.image, { x, y, width: w, height: h });
  else page.drawPage(drawable.page, { x, y, width: w, height: h });
}

async function documentBytes(rel) {
  const full = path.join(here, rel);
  const buf = fs.readFileSync(full);
  const ext = path.extname(full).toLowerCase();
  const contentType =
    ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : 'image/jpeg';
  return {
    bytes: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    contentType,
  };
}

async function embedFile(pdfDoc, meta) {
  if (!meta || !meta.path) return null;
  try {
    const { bytes, contentType } = await documentBytes(meta.path);
    const isPdf = String(contentType).includes('pdf');
    if (isPdf) {
      const pages = await pdfDoc.embedPdf(bytes);
      if (!pages.length) return null;
      return { kind: 'pdf', page: pages[0] };
    }
    const isPng = String(contentType).includes('png');
    const image = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
    return { kind: 'img', image };
  } catch (err) {
    console.warn('embed failed:', meta.path, err.message);
    return null;
  }
}

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

function formatNumber(v) {
  return Number(v || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

async function buildClientPdf(client, invoiceRows) {
  const templateBytes = fs.readFileSync(path.join(root, 'src', 'assets', 'letterhead.pdf'));
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

  const ty = (topY) => height - topY;

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
    `FILE ${safe(client.passport || client.id || '-')}   Â·   GENERATED ${stamp}`,
    {
      x: left,
      y: ty(212),
      maxWidth: 285,
      size: 8,
      font: regular,
      color: GRAY,
    }
  );

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
      drawFitted(page, raw || '-', {
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

const sampleClient = {
  firstName: 'AHMED',
  fatherName: 'KHALED',
  surname: 'AL MANSOURI',
  country: 'UNITED ARAB EMIRATES',
  passport: 'N12345678',
  dateOfBirth: '1990-05-14',
  dateOfIssue: '2022-01-10',
  dateOfExpiry: '2032-01-09',
  issuingPlace: 'ABU DHABI',
  placeOfBirth: 'AL AIN',
  sex: 'MALE',
  referralAgent: 'CUSTOMER',
  status: 'DOCUMENTS SUBMITTED',
  documents: {
    photo: { path: 'sample-photo.png', type: 'image/png' },
    passport: { path: 'sample-passport.png', type: 'image/png' },
    id: { path: 'sample-id.pdf', type: 'application/pdf' },
  },
};

const invoiceRows = [
  { payment: { grandTotal: 15750 }, calc: { paid: 10000, remaining: 5750 } },
  { payment: { grandTotal: 3200 }, calc: { paid: 3200, remaining: 0 } },
];

const bytes = await buildClientPdf(sampleClient, invoiceRows);
fs.writeFileSync(path.join(here, 'out.pdf'), bytes);
console.log('wrote .dev/out.pdf', bytes.length, 'bytes');
