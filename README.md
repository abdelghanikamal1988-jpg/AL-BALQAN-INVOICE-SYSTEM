# AL BALQAN Invoice System

Temporary invoice generator for **AL BALQAN Tourism & Visa Services Company** (Ajman, UAE).

A professional, fast, local-first web app to create, calculate, save, print and export PDF
invoices for visa & residence services.

---

## Project

| Item | Value |
| ---- | ----- |
| Company | AL BALQAN Tourism & Visa Services Company |
| Location | 101 Sara Plaza (2), Al Jurf (2), Al Ittihad St, Ajman, UAE |
| Commercial License | 139681 |
| Phone | +971 6 749 4905 |
| Email | info@albalqan.com |
| Website | www.albalqan.com |
| Currency | AED |

> Invoices are stored locally in the browser. They are **not** sent to any server.

---

## Install

```bash
npm install
```

## Run (development)

```bash
npm run dev
```

Then open the printed URL (e.g. `http://localhost:5173`).

## Open without a server (from disk)

After a build (`npm run build`), you can simply **open `dist/index.html`** by double-clicking
it — the app is built with relative asset paths and hash-based routing, so it works directly
from the filesystem (no web server needed).

## Build (production)

```bash
npm run build
```

Test the production build locally:

```bash
npm run preview
```

---

## Deploy to Netlify

1. Connect the repository (or drag-and-drop the `dist` folder).
2. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
3. The project ships with a `public/_redirects` file:
   ```
   /*    /index.html   200
   ```
   This makes client-side routes (e.g. `/history`, `/edit/abc`) work without 404s.

---

## Editing company data

Everything is in one file: `src/data/company.js`

- Company name, license number, phone, email, website, address
- `invoiceDisclaimer` (the note printed at the bottom of the invoice)
- Currency and logo path

To change the logo, replace `public/logo.png` (keep the same file name). The logo is used with
`object-fit: contain` everywhere so it never stretches or distorts.

---

## Adding a service

Edit **only** `src/data/services.js`:

```js
{ id: 'new-service', label: 'New Service', showResidenceType: false }
```

- `showResidenceType: true` shows the "Residence Type" field in the form for that service.
- The form, live preview, PDF and history update automatically.

---

## Adding a destination

Edit **only** `src/data/destinations.js`:

```js
{ id: 'new-country', label: 'New Country' }
```

The form, preview, PDF and history update automatically.

---

## PDF export

PDF export uses **[jsPDF](https://github.com/parallax/jsPDF)** and draws the invoice directly as a
vector document (text, rectangles and the logo) — no DOM screenshotting, so it works reliably in
every modern browser.

jsPDF is loaded lazily (only when you click "Export PDF"), so it does not slow down the app start.

To change the PDF implementation, edit `src/utils/pdf.js`:

- `pdfFilename(invoice)` — file name: `AL-BALQAN-INV-2026-0001-Customer-Name.pdf`
  (unsafe characters are removed).
- `exportInvoicePdf(invoice)` — draws the full A4 invoice and downloads it.

## Printing

Printing uses the browser's own print dialog on the current page (`window.print()`). The stylesheet
`src/styles/print.css` hides all UI controls and prints only the A4 invoice sheet.

---

## Storage

- Invoices: `localStorage` key `albalqan_invoices`
- Unfinished draft: `localStorage` key `albalqan_invoice_draft`

All storage access lives in `src/utils/storage.js`. The UI never touches `localStorage` directly,
so this layer can be replaced with a REST API / Supabase / Firebase in the future without rewriting
the components.

### Backup

Because data is local-only:

- **Export Data** downloads all invoices as JSON (`albalqan-invoices-backup-YYYY-MM-DD.json`).
- **Import Data** restores a backup on another device (duplicate invoice IDs are skipped).

> Clearing browser storage may result in permanent loss of local records. Export a backup
> regularly.

---

## Project structure

```
src/
├── components/
│   ├── Header/
│   ├── InvoiceForm/
│   ├── CustomerSection/
│   ├── ServiceSection/
│   ├── PaymentSection/
│   ├── InvoicePreview/
│   ├── InvoiceHistory/
│   ├── SearchBar/
│   ├── Modal/
│   ├── Toast/
│   └── ErrorBoundary/
├── pages/
│   ├── Dashboard/
│   ├── CreateInvoice/
│   └── InvoiceHistory/
├── data/
│   ├── company.js
│   ├── services.js
│   └── destinations.js
├── utils/
│   ├── invoiceNumber.js
│   ├── paymentCalculator.js
│   ├── formatCurrency.js
│   ├── formatDate.js
│   ├── money.js
│   ├── storage.js
│   ├── pdf.js
│   ├── print.js
│   └── validation.js
└── styles/
    ├── global.css
    ├── dashboard.css
    ├── invoice.css
    └── print.css
```
