/**
 * Print helper — uses the browser's own print dialog on the current page.
 * The print stylesheet (print.css) ensures only the invoice is printed.
 *
 * mode:
 *  - 'create'  : the on-screen invoice sheet on the Create Invoice page
 *  - 'history' : a dedicated .print-area container (rendered via portal)
 */

export function printInvoice(mode = 'create') {
  if (mode === 'history') {
    document.body.classList.add('printing-history');
  } else {
    document.body.classList.add('printing-create');
  }

  const cleanup = () => {
    document.body.classList.remove('printing-history', 'printing-create');
  };

  if (window.matchMedia) {
    const mql = window.matchMedia('print');
    const handler = (e) => {
      if (!e.matches) {
        cleanup();
        mql.removeEventListener('change', handler);
      }
    };
    mql.addEventListener('change', handler);
  }

  window.print();

  // Fallback cleanup in case the matchMedia listener never fires.
  setTimeout(cleanup, 5000);
}
