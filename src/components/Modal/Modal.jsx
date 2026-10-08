import { useEffect, useRef } from 'react';
import { useLang } from '../../context/LangContext.jsx';

export default function Modal({ title, onClose, children, actions, danger = false, className = '' }) {
  const overlayRef = useRef(null);
  const { t } = useLang();

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="modal-overlay no-print"
      role="dialog"
      aria-modal="true"
      aria-label={t(title)}
      ref={overlayRef}
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className={className ? `modal ${className}` : 'modal'}>
        <div className="modal__header">
          <h3>{t(title)}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label={t('common.close')}>
            &times;
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {actions && <div className="modal__actions">{actions}</div>}
      </div>
    </div>
  );
}
