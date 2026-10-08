(async () => {
  const q = (s) => document.querySelector(s);
  const pos = (sel) => {
    const el = q(sel);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return [Math.round(b.top), Math.round(b.bottom)];
  };
  const row1 = q('[aria-label="Invoices per month"]');
  const row2 = q('[aria-label="Clients and invoices"]');
  const out = {
    order: row1 && row2 ? (row1.compareDocumentPosition(row2) & Node.DOCUMENT_POSITION_FOLLOWING ? 'charts-first' : 'donut-first') : null,
    row1: pos('[aria-label="Invoices per month"]'),
    row2: pos('[aria-label="Clients and invoices"]'),
    agents: pos('[aria-label="Agent performance"]'),
    cust: pos('[aria-label="Top customers"]'),
    logs: pos('[aria-label="Access logs"]'),
  };
  document.querySelectorAll('.db-bars__col')[3]?.classList.add('is-active');
  document.querySelectorAll('.db-lhit')[4]?.classList.add('is-active');
  return JSON.stringify(out);
})()
