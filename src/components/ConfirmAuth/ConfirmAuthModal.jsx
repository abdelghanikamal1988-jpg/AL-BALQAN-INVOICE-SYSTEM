import { useState } from 'react';
import Modal from '../Modal/Modal.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
import { supabase } from '../../lib/supabase.js';
import { recordAccess } from '../../utils/accessLog.js';

/**
 * Password re-confirmation gate shown before destructive actions
 * (deleting an invoice or a client).
 *
 * It verifies the credentials of the account that is ALREADY signed in —
 * entering a different account's email is rejected, so the session can
 * never switch user. On success the parent's confirm action runs.
 */
export default function ConfirmAuthModal({
  title = 'shell.confirmIdentity',
  reason,
  confirmLabel = 'shell.confirmAndDelete',
  onCancel,
  onConfirm,
  onSuccess,
}) {
  const { user } = useAuth();
  const { t } = useLang();
  const signedIn = String(user?.email || '').trim().toLowerCase();

  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const mail = String(email || '').trim().toLowerCase();

    if (!mail || !password) {
      setError('shell.errEnterEmailPassword');
      return;
    }
    if (mail !== signedIn) {
      setError('shell.errEnterSignedInAccount');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: mail,
        password,
      });
      if (signInError) {
        recordAccess({
          action: 'FAILED RE-AUTH',
          account: mail,
          details: 'Wrong password at confirmation prompt',
        });
        setError('shell.errIncorrectCredentials');
        return;
      }
      recordAccess({
        action: 'RE-AUTH',
        account: mail,
        details: 'Identity confirmed for a sensitive action',
      });
      await onConfirm();
      onSuccess();
    } catch (err) {
      setError((err && err.message) || 'shell.errVerificationFailed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={title}
      onClose={busy ? () => {} : onCancel}
      actions={
        <>
          <button
            type="button"
            className="btn btn--neutral"
            onClick={onCancel}
            disabled={busy}
          >
            {t('shell.cancel')}
          </button>
          <button
            type="submit"
            form="confirm-auth-form"
            className="btn btn--danger"
            disabled={busy}
          >
            {busy ? <span className="btn__spinner" aria-hidden="true" /> : t(confirmLabel)}
          </button>
        </>
      }
    >
      <form id="confirm-auth-form" className="confirm-auth" onSubmit={handleSubmit}>
        <p className="confirm-auth__reason">{t(reason)}</p>

        <div className="field">
          <label htmlFor="confirm-auth-email">{t('shell.email')}</label>
          <input
            id="confirm-auth-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            autoFocus
            disabled={busy}
          />
        </div>

        <div className="field">
          <label htmlFor="confirm-auth-password">{t('shell.password')}</label>
          <input
            id="confirm-auth-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={busy}
          />
        </div>

        {error && <span className="field__error confirm-auth__error">{t(error)}</span>}
      </form>
    </Modal>
  );
}
