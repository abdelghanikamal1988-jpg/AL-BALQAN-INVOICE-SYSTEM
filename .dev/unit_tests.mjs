/**
 * Unit tests for the core business logic.
 *
 * Runs on Node's built-in test runner — no extra dependency:
 *   node --test .dev/unit_tests.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { calculatePayment, PAYMENT_STATUS } from '../src/utils/paymentCalculator.js';
import { calculateVat, VAT_MODE } from '../src/utils/vat.js';
import { hasArabic, toUpperLatin, arabicFieldKeys } from '../src/utils/textCase.js';
import { whatsappDigits } from '../src/utils/whatsapp.js';
import { transliterateArabic, pdfSafeText, containsArabic } from '../src/utils/arabicLatin.js';
import { validateClientForm, normalizePassport, emptyClientForm, formToClient, invoicePrefillFromClient } from '../src/utils/clients.js';
import { createInvoiceObject } from '../src/utils/storage.js';
import { fileNumberDayPrefix, fileNumberFromCounter } from '../src/utils/fileNumber.js';
import { normalizeName, isEmailValid, isPhoneValid, validateNewPassword, PASSWORD_MIN_LENGTH } from '../src/utils/validation.js';
import { reportPdfFailure } from '../src/utils/pdf.js';
import { DOCUMENT_TYPES, normalizeDocuments, visaVisibility } from '../src/utils/uploads.js';
import { ACTION_PERMISSIONS, ROLE_PRESETS } from '../src/auth/permissions.js';

/* ------------------------- paymentCalculator ------------------------- */

test('calculatePayment: unpaid', () => {
  const r = calculatePayment(1000, 0);
  assert.equal(r.status, PAYMENT_STATUS.UNPAID);
  assert.equal(r.remaining, 1000);
});

test('calculatePayment: fully paid', () => {
  const r = calculatePayment(1000, 1000);
  assert.equal(r.status, PAYMENT_STATUS.PAID);
  assert.equal(r.remaining, 0);
});

test('calculatePayment: partially paid', () => {
  const r = calculatePayment(1000, 400);
  assert.equal(r.status, PAYMENT_STATUS.PARTIALLY_PAID);
  assert.equal(r.remaining, 600);
});

test('calculatePayment: paid clamped to total', () => {
  const r = calculatePayment(1000, 1500);
  assert.equal(r.paid, 1000);
  assert.equal(r.remaining, 0);
});

test('calculatePayment: floating point is stable', () => {
  const r = calculatePayment(0.1 + 0.2, 0.3);
  assert.equal(r.status, PAYMENT_STATUS.PAID);
});

/* ------------------------------- vat --------------------------------- */

test('calculateVat: none leaves the total untouched', () => {
  const v = calculateVat(1000, VAT_MODE.NONE);
  assert.equal(v.grandTotal, 1000);
  assert.equal(v.vat, 0);
});

test('calculateVat: excluded adds 5% on top', () => {
  const v = calculateVat(1000, VAT_MODE.EXCLUDED);
  assert.equal(v.vat, 50);
  assert.equal(v.grandTotal, 1050);
});

test('calculateVat: included extracts the 5%', () => {
  const v = calculateVat(1050, VAT_MODE.INCLUDED);
  assert.ok(Math.abs(v.vat - 50) < 0.01);
  assert.equal(v.subtotal, 1000);
});

/* ----------------------------- textCase ------------------------------ */

test('hasArabic detects Arabic script', () => {
  assert.equal(hasArabic('محمد'), true);
  assert.equal(hasArabic('MOHAMED'), false);
  assert.equal(hasArabic('MOHAMED محمد'), true);
  assert.equal(hasArabic(''), false);
  assert.equal(hasArabic(null), false);
});

test('toUpperLatin collapses whitespace and uppercases', () => {
  assert.equal(toUpperLatin('  essam   wael  '), 'ESSAM WAEL');
  assert.equal(toUpperLatin(null), '');
  assert.equal(toUpperLatin(42), '42');
});

test('arabicFieldKeys lists only the Arabic fields', () => {
  const keys = arabicFieldKeys({ a: 'MOHAMED', b: 'القاهرة', c: '' });
  assert.deepEqual(keys, ['b']);
});

/* ----------------------------- whatsapp ------------------------------ */

test('whatsappDigits: Egyptian mobile with trunk zero', () => {
  assert.equal(whatsappDigits('01012345678'), '201012345678');
  assert.equal(whatsappDigits('01112345678'), '201112345678');
  assert.equal(whatsappDigits('01212345678'), '201212345678');
  assert.equal(whatsappDigits('01512345678'), '201512345678');
});

test('whatsappDigits: Egyptian mobile without trunk zero', () => {
  assert.equal(whatsappDigits('1012345678'), '201012345678');
});

test('whatsappDigits: UAE fallback', () => {
  assert.equal(whatsappDigits('0501234567'), '971501234567');
  assert.equal(whatsappDigits('501234567'), '971501234567');
});

test('whatsappDigits: explicit country code is never re-prefixed', () => {
  assert.equal(whatsappDigits('+201012345678'), '201012345678');
  assert.equal(whatsappDigits('+971501234567'), '971501234567');
  assert.equal(whatsappDigits('00201012345678'), '201012345678');
});

test('whatsappDigits: empty and garbage', () => {
  assert.equal(whatsappDigits(''), '');
  assert.equal(whatsappDigits('abc'), '');
});

/* --------------------------- arabicLatin ----------------------------- */

test('transliterateArabic: known place names', () => {
  assert.equal(transliterateArabic('القاهرة'), 'CAIRO');
  assert.equal(transliterateArabic('الإمارات'), 'UAE');
});

test('transliterateArabic: Arabic digits', () => {
  assert.equal(transliterateArabic('١٢٣٤٥'), '12345');
});

test('transliterateArabic: Latin passes through uppercased', () => {
  assert.equal(transliterateArabic('mohamed'), 'MOHAMED');
});

test('pdfSafeText: Latin only is untouched', () => {
  assert.equal(pdfSafeText('CAIRO'), 'CAIRO');
  assert.equal(pdfSafeText(''), '');
});

test('pdfSafeText: Arabic becomes readable Latin', () => {
  assert.equal(pdfSafeText('القاهرة'), 'CAIRO');
});

test('containsArabic mirrors hasArabic', () => {
  assert.equal(containsArabic('MOHAMED'), false);
  assert.equal(containsArabic('محمد'), true);
});

/* ---------------------------- validation ----------------------------- */

test('normalizeName collapses whitespace', () => {
  assert.equal(normalizeName('  Ahmed    Ali  '), 'Ahmed Ali');
});

test('isEmailValid', () => {
  assert.equal(isEmailValid('a@b.co'), true);
  assert.equal(isEmailValid('not-an-email'), false);
  assert.equal(isEmailValid(''), true); // optional
});

test('isPhoneValid', () => {
  assert.equal(isPhoneValid('+201012345678'), true);
  assert.equal(isPhoneValid('abc'), false);
  assert.equal(isPhoneValid(''), true); // optional
});

test('validateNewPassword accepts a matching password at the minimum length', () => {
  const pw = 'a'.repeat(PASSWORD_MIN_LENGTH);
  assert.deepEqual(validateNewPassword(pw, pw), { ok: true });
  assert.equal(PASSWORD_MIN_LENGTH, 8);
});

test('validateNewPassword rejects short passwords', () => {
  const short = 'a'.repeat(PASSWORD_MIN_LENGTH - 1);
  assert.deepEqual(validateNewPassword(short, short), { ok: false, error: 'short' });
  assert.deepEqual(validateNewPassword('', ''), { ok: false, error: 'short' });
});

test('validateNewPassword rejects mismatched confirmation', () => {
  const pw = 'longenough1';
  assert.deepEqual(validateNewPassword(pw, pw + 'x'), { ok: false, error: 'mismatch' });
  assert.deepEqual(validateNewPassword(pw, undefined), { ok: false, error: 'mismatch' });
});

test('normalizePassport strips non-alphanumerics', () => {
  assert.equal(normalizePassport('ab-12 cd'), 'AB12CD');
});

test('validateClientForm: empty form flags every required field', () => {
  const errors = validateClientForm(emptyClientForm());
  const expected = [
    'firstName', 'fatherName', 'surname', 'country', 'passport',
    'dateOfBirth', 'dateOfIssue', 'dateOfExpiry', 'issuingPlace',
    'placeOfBirth', 'sex', 'destination', 'service', 'referralAgent',
  ];
  assert.deepEqual(Object.keys(errors).sort(), expected.sort());
});

test('validateClientForm: a filled form has no errors', () => {
  const form = {
    firstName: 'MOHAMED', fatherName: 'AHMED', surname: 'KHALID',
    country: 'EGYPT', passport: 'A1234567',
    dateOfBirth: '1990-01-01', dateOfIssue: '2020-01-01', dateOfExpiry: '2030-01-01',
    issuingPlace: 'CAIRO', placeOfBirth: 'CAIRO', sex: 'Male',
    destination: 'Albania', service: 'Tourist Visa',
    referralAgent: 'AGENT ONE',
  };
  assert.deepEqual(validateClientForm(form), {});
});

test('validateClientForm: Arabic in any field is rejected', () => {
  const form = {
    firstName: 'MOHAMED', fatherName: 'AHMED', surname: 'KHALID',
    country: 'القاهرة', passport: 'A1234567',
    dateOfBirth: '1990-01-01', dateOfIssue: '2020-01-01', dateOfExpiry: '2030-01-01',
    issuingPlace: 'CAIRO', placeOfBirth: 'CAIRO', sex: 'Male',
    referralAgent: 'AGENT ONE',
  };
  const errors = validateClientForm(form);
  assert.equal(errors.country, 'clients.err.arabicOnly');
});

/* ------------------------- client file number ------------------------- */

test('createInvoiceObject: linked invoice carries the client file number', () => {
  const inv = createInvoiceObject(
    { name: 'AHMED ALI', passport: 'P1234567', total: 1000, paid: 0, vatMode: 'none' },
    'INV-2026-0001',
    { id: 'cli-1', name: 'AHMED ALI', fileNo: 'FILE-2026-0001' }
  );
  assert.equal(inv.client.id, 'cli-1');
  assert.equal(inv.client.name, 'AHMED ALI');
  assert.equal(inv.client.fileNo, 'FILE-2026-0001');
});

test('createInvoiceObject: an unlinked invoice keeps the legacy shape', () => {
  const inv = createInvoiceObject(
    { name: 'AHMED ALI', passport: 'P1234567', total: 1000, paid: 0, vatMode: 'none' },
    'INV-2026-0002'
  );
  assert.equal('client' in inv, false);
});

test('createInvoiceObject: linked client without a file number stays safe', () => {
  const inv = createInvoiceObject(
    { name: 'AHMED ALI', total: 100, paid: 0, vatMode: 'none' },
    'INV-2026-0003',
    { id: 'cli-2', name: 'AHMED ALI' }
  );
  assert.equal(inv.client.id, 'cli-2');
  assert.equal(inv.client.fileNo, '');
});

test('formToClient: keeps the permanent file number', () => {
  const client = formToClient(emptyClientForm(), {
    id: 'cli-3',
    documents: {},
    pdfPath: null,
    fileNo: 'FILE-2026-0007',
  });
  assert.equal(client.fileNo, 'FILE-2026-0007');
});

test('formToClient: legacy call without a file number falls back to empty', () => {
  const client = formToClient(emptyClientForm(), {
    id: 'cli-4',
    documents: {},
    pdfPath: null,
  });
  assert.equal(client.fileNo, '');
});

test('fileNumber: counter key uses day and month of the day', () => {
  assert.equal(fileNumberDayPrefix(new Date(2026, 9, 21)), 'FILE-2110');
  assert.equal(fileNumberDayPrefix(new Date(2026, 0, 5)), 'FILE-0501');
});

test('fileNumber: counter value becomes FILE-YYYY-DDMM + daily sequence', () => {
  assert.equal(fileNumberFromCounter('FILE-2110-2026-0001'), 'FILE-2026-21101');
  assert.equal(fileNumberFromCounter('FILE-2110-2026-0042'), 'FILE-2026-211042');
  assert.equal(fileNumberFromCounter('FILE-0501-2026-0009'), 'FILE-2026-05019');
});

test('fileNumber: unrelated counter values are rejected', () => {
  assert.equal(fileNumberFromCounter('INV-2026-0001'), '');
  assert.equal(fileNumberFromCounter('FILE-2110-2026'), '');
  assert.equal(fileNumberFromCounter(''), '');
  assert.equal(fileNumberFromCounter(null), '');
});

test('createInvoiceObject: an agent invoice stores who it is billed to', () => {
  const base = { name: 'AHMED ALI', passport: 'P1', total: 1000, paid: 0, vatMode: 'none' };
  const agent = createInvoiceObject(
    { ...base, billedType: 'agent', billedName: '  MOHAMED AGENT  ' },
    'INV-2026-0010'
  );
  assert.equal(agent.billedTo.type, 'agent');
  assert.equal(agent.billedTo.name, 'MOHAMED AGENT');
});

test('createInvoiceObject: a direct customer keeps the legacy shape', () => {
  const base = { name: 'AHMED ALI', passport: 'P1', total: 1000, paid: 0, vatMode: 'none' };
  const direct = createInvoiceObject(
    { ...base, billedType: 'customer', billedName: 'IGNORED' },
    'INV-2026-0011'
  );
  assert.equal('billedTo' in direct, false);

  const blankAgent = createInvoiceObject(
    { ...base, billedType: 'agent', billedName: '   ' },
    'INV-2026-0012'
  );
  assert.equal('billedTo' in blankAgent, false);
});

test('reportPdfFailure: popup-blocked print reports the downloaded file instead of an error', () => {
  const calls = [];
  const toast = { success: () => {}, error: (m) => calls.push(['error', m]), info: (m) => calls.push(['info', m]) };
  const t = (key) => key;
  const realError = console.error;
  console.error = () => {};
  reportPdfFailure(new Error('popup-blocked'), toast, t, 'print');
  console.error = realError;
  assert.deepEqual(calls, [['info', 'invoice.printSavedInstead']]);
});

test('reportPdfFailure: missing jsPDF chunk asks for a refresh', () => {
  const calls = [];
  const toast = { success: () => {}, error: (m) => calls.push(['error', m]), info: (m) => calls.push(['info', m]) };
  const t = (key) => key;
  const err = new Error('pdf-engine-load');
  err.code = 'PDF_ENGINE_LOAD';
  const realError = console.error;
  console.error = () => {};
  reportPdfFailure(err, toast, t, 'export');
  reportPdfFailure(err, toast, t, 'print');
  console.error = realError;
  assert.deepEqual(calls, [
    ['error', 'invoice.pdfNeedsRefresh'],
    ['error', 'invoice.pdfNeedsRefresh'],
  ]);
});

test('reportPdfFailure: unknown failures keep the classic message per kind', () => {
  const calls = [];
  const toast = { success: () => {}, error: (m) => calls.push(['error', m]), info: (m) => calls.push(['info', m]) };
  const t = (key) => key;
  const realError = console.error;
  console.error = () => {};
  reportPdfFailure(new Error('boom'), toast, t, 'export');
  reportPdfFailure(new Error('boom'), toast, t, 'print');
  console.error = realError;
  assert.deepEqual(calls, [
    ['error', 'invoice.pdfExportFailed'],
    ['error', 'invoice.printDialogFailed'],
  ]);
});

test('invoicePrefillFromClient: maps a client record onto empty invoice fields', () => {
  const prefill = invoicePrefillFromClient({
    id: 'c1',
    firstName: 'MOHAMED',
    fatherName: 'ESSAM',
    surname: 'ELSAYED',
    country: 'EGYPT',
    passport: 'A23478',
    destination: 'Albania',
    service: 'Tourist Visa',
    referralAgent: 'ESSAM',
    fileNo: 'FILE-2210-2026',
  });
  assert.deepEqual(prefill, {
    name: 'MOHAMED ESSAM ELSAYED',
    nationality: 'EGYPT',
    passport: 'A23478',
    destination: 'albania',
    service: 'tourist-visa',
  });
});

test('invoicePrefillFromClient: invoice ids pass through, unknown values blank', () => {
  const byId = invoicePrefillFromClient({
    firstName: 'A',
    fatherName: 'B',
    surname: 'C',
    country: 'X',
    passport: 'P1',
    destination: 'serbia',
    service: 'work-contract',
  });
  assert.equal(byId.destination, 'serbia');
  assert.equal(byId.service, 'work-contract');

  const unknown = invoicePrefillFromClient({
    firstName: 'A',
    fatherName: 'B',
    surname: 'C',
    country: 'X',
    passport: 'P1',
    destination: 'Atlantis',
    service: 'Rocket Ride',
  });
  assert.equal(unknown.destination, '');
  assert.equal(unknown.service, '');
});

test('invoicePrefillFromClient: client service labels map to invoice services', () => {
  const base = { firstName: 'A', fatherName: 'B', surname: 'C', country: 'X', passport: 'P1' };
  assert.equal(invoicePrefillFromClient({ ...base, service: 'Labor Contract' }).service, 'work-contract');
  assert.equal(invoicePrefillFromClient({ ...base, service: 'Resident Visa' }).service, 'residence');
  assert.equal(invoicePrefillFromClient(null), null);
});

test('DOCUMENT_TYPES: visa slot is a single optional PDF document', () => {
  const visa = DOCUMENT_TYPES.find((def) => def.id === 'visa');
  assert.ok(visa, 'visa type must exist');
  assert.equal(visa.accept, 'application/pdf');
  assert.equal(visa.optional, true);
  assert.ok(!visa.multiple, 'visa is a single slot');
  assert.equal(DOCUMENT_TYPES.filter((def) => !def.multiple).length, 3);
});

test('normalizeDocuments: keeps the visa slot untouched', () => {
  const visa = { path: 'clients/u1/c1/visa.pdf', name: 'visa.pdf', type: 'application/pdf' };
  const docs = normalizeDocuments({ visa, passport: { path: 'clients/u1/c1/p.png', name: 'p.png' } });
  assert.equal(docs.visa.path, 'clients/u1/c1/visa.pdf');
  assert.equal(docs.visa.name, 'visa.pdf');
  assert.equal(normalizeDocuments({}).visa, undefined);
});

test('formToClient: keeps the visa publish timestamp', () => {
  const form = { ...emptyClientForm(), visaPublishedAt: '2026-10-23T12:00:00.000Z' };
  const client = formToClient(form, {
    id: 'cli-5',
    documents: {},
    pdfPath: null,
    fileNo: 'FILE-2026-0008',
  });
  assert.equal(client.visaPublishedAt, '2026-10-23T12:00:00.000Z');
});

test('formToClient: a fresh record has no visa publish timestamp', () => {
  const client = formToClient(emptyClientForm(), { id: 'cli-6', documents: {}, pdfPath: null });
  assert.equal(client.visaPublishedAt, null);
});

test('permissions: action:client.visa exists and stays out of the presets', () => {
  assert.ok(ACTION_PERMISSIONS.some((p) => p.key === 'action:client.visa'));
  assert.ok(!ROLE_PRESETS.employee.includes('action:client.visa'));
  assert.ok(!ROLE_PRESETS.delegate.includes('action:client.visa'));
  assert.ok(ROLE_PRESETS.admin.includes('action:client.visa'));
  assert.equal(ROLE_PRESETS.custom.length, 0);
});

test('visaVisibility: a viewer only sees a published visa', () => {
  const meta = { path: 'clients/u1/c1/visa.pdf' };
  const hidden = visaVisibility(false, meta, null);
  assert.equal(hidden.show, false);
  assert.equal(hidden.canDownload, false);
  assert.equal(hidden.canUpload, false);
  assert.equal(hidden.canPublish, false);
  const released = visaVisibility(false, meta, '2026-10-23T12:00:00.000Z');
  assert.equal(released.show, true);
  assert.equal(released.canDownload, true);
  assert.equal(released.canUpload, false);
  assert.equal(released.canPublish, false);
  assert.equal(released.published, true);
});

test('visaVisibility: a visa holder controls upload, replace and publish', () => {
  const empty = visaVisibility(true, null, null);
  assert.equal(empty.show, true);
  assert.equal(empty.canDownload, false);
  assert.equal(empty.canUpload, true);
  assert.equal(empty.canPublish, false);
  const ready = visaVisibility(true, { path: 'clients/u1/c1/visa.pdf' }, null);
  assert.equal(ready.show, true);
  assert.equal(ready.canDownload, true);
  assert.equal(ready.canUpload, true);
  assert.equal(ready.canPublish, true);
  const done = visaVisibility(true, { path: 'clients/u1/c1/visa.pdf' }, '2026-10-23T12:00:00.000Z');
  assert.equal(done.show, true);
  assert.equal(done.canDownload, true);
  assert.equal(done.canPublish, false);
  assert.equal(done.published, true);
});
