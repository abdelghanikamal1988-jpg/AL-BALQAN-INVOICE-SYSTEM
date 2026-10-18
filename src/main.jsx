import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary.jsx';
import './styles/theme.css';
import './styles/global.css';
import './styles/dashboard.css';
import './styles/invoice.css';
import './styles/print.css';
import './styles/responsive.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

/* PWA: register the offline app-shell worker. It only activates on a
   secure origin (https or localhost), so the dev server is unaffected. */
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* registration failure must never break the app */
    });
  });
}
