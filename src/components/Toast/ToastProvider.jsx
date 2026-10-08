import { createContext, useCallback, useContext, useState } from 'react';
import Icon from '../Icons/Icon.jsx';
import { useLang } from '../../context/LangContext.jsx';

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const { t } = useLang();

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message, type = 'info', duration = 4000) => {
      const id = ++toastId;
      setToasts((prev) => [...prev, { id, message, type }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  const success = useCallback((m) => push(m, 'success'), [push]);
  const error = useCallback((m) => push(m, 'error', 5000), [push]);
  const info = useCallback((m) => push(m, 'info'), [push]);

  return (
    <ToastContext.Provider value={{ success, error, info }}>
      {children}
      <div className="toast-container no-print" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.type}`} role="status">
            <span className="toast__msg">{toast.message}</span>
            <button
              type="button"
              className="toast__close"
              aria-label={t('shell.dismissNotification')}
              onClick={() => dismiss(toast.id)}
            >
              <Icon name="x" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
