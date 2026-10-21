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
import { validateClientForm, normalizePassport, emptyClientForm, formToClient } from '../src/utils/clients.js';
import { createInvoiceObject } from '../src/utils/storage.js';
import { fileNumberDayPrefix, fileNumberFromCounter } from '../src/utils/fileNumber.js';
import { normalizeName, isEmailValid, isPhoneValid } from '../src/utils/validation.js';

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
