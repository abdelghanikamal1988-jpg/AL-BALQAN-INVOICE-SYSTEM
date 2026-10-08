(async () => {
  const r = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return [Math.round(b.top), Math.round(b.bottom)];
  };
  return JSON.stringify({
    row1: r('[aria-label="Invoices per month"]'),
    row2: r('[aria-label="Clients and invoices"]'),
    agents: r('[aria-label="Agent performance"]'),
    cust: r('[aria-label="Top customers"]'),
    inv: r('[aria-label="Recent invoices"]'),
    logs: r('[aria-label="Access logs"]'),
  });
})()
