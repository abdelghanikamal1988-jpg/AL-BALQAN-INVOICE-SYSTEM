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

> Invoices and client records are stored in **Supabase** (per-user, protected by row level
> security). Only the unfinished draft stays in the browser.

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

Netlify is the only deployment target. Build settings live in `netlify.toml`
(build command `npm run build`, publish directory `dist`, Node 20, SPA redirect).

1. Connect the repository (or drag-and-drop the `dist` folder).
2. In **Site configuration > Environment variables** add the Supabase keys
   (`.env` is gitignored, so Netlify does not receive them from the repo):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy.

Client-side routes (e.g. `/history`, `/edit/abc`) work without 404s because
`netlify.toml` and `public/_redirects` both serve `index.html` for every path.

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

## Clients (application & documents)

A separate module for client applications — it **never** touches the invoice records.

- **Setup:** run `supabase/clients.sql` once in the Supabase SQL editor (after
  `supabase/schema.sql`). It creates `referral_agents`, `clients` and the two private storage
  buckets `client-documents` / `client-pdfs`.
- **Pages:** `/clients` (list, search, agent filter), `/clients/new`,
  `/clients/:id` (record, documents, status, PDF), `/clients/:id/edit`.
- **Required fields:** Name, Father Name, Surname, Country, Passport No., Date of Birth,
  Date of Issue, Date of Expiry, Issuing Place, Place of Birth, Sex, Referral Agent
  (text fields are typed and displayed in uppercase).
- **Documents:** exactly three slots — Passport, ID, Personal Photo (JPG/PNG/PDF, max 10 MB each).
  They are optional; saving without them asks for confirmation.
- **PDF:** generated with `pdf-lib` **on top of** `src/assets/letterhead.pdf`, which is loaded as-is
  (never redrawn) and **inlined into the bundle** as a data URI — no runtime download, so browser
  extensions/ad-blockers can never block it (`ERR_BLOCKED_BY_CLIENT`). The page size is read from
  the template, so replacing the file with an A4 export needs no code change. The result is stored
  in the `client-pdfs` bucket and downloaded.
- **Invoices:** amounts are matched by normalised passport number and read live from the invoice
  system. No money is stored in the client record.

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

- Invoices: Supabase table `public.invoices` (one JSONB `data` column, row level security)
- Clients: Supabase table `public.clients`, agents: `public.referral_agents`
- Documents / generated client PDFs: Supabase Storage buckets `client-documents`, `client-pdfs`
- Unfinished draft: `localStorage` key `albalqan_invoice_draft`

All access lives in `src/utils/storage.js` (invoices), `src/lib/invoiceRepo.js`,
`src/lib/clientRepo.js` and `src/utils/uploads.js` (clients). The UI never calls Supabase
directly, so this layer can be replaced without rewriting the components.

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
│   ├── InvoiceHistory/
│   ├── Clients/
│   ├── ClientForm/
│   └── ClientDetail/
├── lib/
│   ├── supabase.js
│   ├── invoiceRepo.js
│   └── clientRepo.js
├── data/
│   ├── company.js
│   ├── services.js
│   ├── destinations.js
│   └── clientStatuses.js
├── utils/
│   ├── invoiceNumber.js
│   ├── paymentCalculator.js
│   ├── formatCurrency.js
│   ├── formatDate.js
│   ├── money.js
│   ├── storage.js
│   ├── pdf.js
│   ├── print.js
│   ├── validation.js
│   ├── vat.js
│   ├── clients.js
│   ├── clientPdf.js
│   └── uploads.js
└── styles/
    ├── global.css
    ├── dashboard.css
    ├── invoice.css
    ├── clients.css
    └── print.css
```
