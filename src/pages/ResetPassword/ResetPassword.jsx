import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../components/Toast/ToastProvider.jsx';
import Logo from '../../components/Logo/Logo.jsx';
import Icon from '../../components/Icons/Icon.jsx';
import { supabase } from '../../lib/supabase.js';
import { recordAccess } from '../../utils/accessLog.js';
import { validateNewPassword, PASSWORD_MIN_LENGTH } from '../../utils/validation.js';

/**
 * "Set a new password" — reached from the link in the recovery email
 * (#/reset-password). Same isolated gate as Login: always English, LTR.
 */
export default function ResetPassword() {
  const navigate = useNavigate();
  const toast = useToast();
  const { session, configured, clearRecovery } = useAuth();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!configured || !session) {
      toast.error('This reset link has expired. Ask for a new one from the sign-in screen.');
      return;
    }
    const check = validateNewPassword(password, confirm);
    if (!check.ok) {
      toast.error(
        check.error === 'short'
          ? `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
          : 'The two passwords do not match.',
      );
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(
          error.message || 'Could not update the password. Ask for a new link and try again.'
        );
        return;
      }
      recordAccess({
        action: 'PASSWORD RESET',
        account: session.user?.email || '',
        details: 'Password replaced from the recovery link',
      });
      clearRecovery();
      setDone(true);
      toast.success('Your password has been updated.');
    } catch (err) {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const goToSignIn = () => {
    clearRecovery();
    navigate('/');
  };

  return (
    <div className="login-page">
      <div className="login-frame">
        <div className="login-brand">
          <span className="login-brand__tile">
            <Logo />
          </span>
        </div>

        <div className="card login-card">
          <span className="login-card__strip" aria-hidden="true" />

          {!session ? (
            <>
              <h1 className="login-card__title">Link expired</h1>
              <p className="login-card__sub">
                This reset link has expired or was already used. Request a new one from the
                sign-in screen.
              </p>
              <button type="button" className="btn btn--primary btn--block" onClick={goToSignIn}>
                <Icon name="login" aria-hidden="true" />
                Back to sign in
              </button>
            </>
          ) : done ? (
            <>
              <h1 className="login-card__title">Password updated</h1>
              <p className="login-card__sub">
                Your password has been changed. Sign in with the new password to continue.
              </p>
              <button type="button" className="btn btn--primary btn--block" onClick={goToSignIn}>
                <Icon name="login" aria-hidden="true" />
                Continue to sign in
              </button>
            </>
          ) : (
            <>
              <h1 className="login-card__title">Set a new password</h1>
              <p className="login-card__sub">
                Choose a password of at least {PASSWORD_MIN_LENGTH} characters and confirm it
                below.
              </p>

              <form className="login-form" onSubmit={handleSubmit}>
                <div className="field">
                  <label htmlFor="reset-password">New password</label>
                  <input
                    id="reset-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label htmlFor="reset-confirm">Repeat new password</label>
                  <input
                    id="reset-confirm"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Type it again"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
                  {busy ? (
                    <span className="btn__spinner" aria-hidden="true" />
                  ) : (
                    <>
                      <Icon name="lock" aria-hidden="true" />
                      Update password
                    </>
                  )}
                </button>
              </form>

              <div className="login-card__hint">
                <p className="login-card__hint-title">Security</p>
                <p className="login-card__hint-text">
                  After this you sign in with the new password, and two-factor verification still
                  applies when it is enabled for your account.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
