import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../components/Toast/ToastProvider.jsx';
import Logo from '../../components/Logo/Logo.jsx';
import Icon from '../../components/Icons/Icon.jsx';
import { migrateLocalInvoices } from '../../utils/storage.js';
import { needsChallenge, activeTotpFactor, createChallenge, verifyChallenge } from '../../utils/mfa.js';
import { supabase } from '../../lib/supabase.js';
import { isEmailValid } from '../../utils/validation.js';

export default function Login() {
  const navigate = useNavigate();
  const toast = useToast();
  const { signIn, configured, session } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  /* 'signin' — the normal form. 'forgot' — ask for a recovery link by email. */
  const [mode, setMode] = useState('signin');
  const [resetSent, setResetSent] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  /* Optional 2FA step — only shown when the account has a verified factor. */
  const [mfaFactor, setMfaFactor] = useState(null);
  const [mfaChallengeId, setMfaChallengeId] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaGateFailed, setMfaGateFailed] = useState(false);
  const codeRef = useRef(null);

  const startChallenge = async (factor) => {
    const challenge = await createChallenge(factor.id);
    setMfaChallengeId(challenge.id);
  };

  const enterMfaStep = async () => {
    if (!(await needsChallenge())) return false;
    const factor = await activeTotpFactor();
    if (!factor) return false;
    setMfaFactor(factor);
    await startChallenge(factor);
    return true;
  };

  useEffect(() => {
    if (mfaFactor) codeRef.current?.focus();
  }, [mfaFactor]);

  useEffect(() => {
    if (!session) {
      setMfaGateFailed(false);
      return undefined;
    }
    enterMfaStep().catch(() => setMfaGateFailed(true));
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const finishSignIn = async () => {
    const migrated = await migrateLocalInvoices();
    if (migrated > 0) {
      toast.success(`${migrated} invoice${migrated > 1 ? 's were' : ' was'} migrated from this device.`);
    } else {
      toast.success('Welcome back.');
    }
    navigate('/');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!configured) {
      toast.error('Database is not configured yet. Contact the administrator.');
      return;
    }
    const mail = email.trim().toLowerCase();
    if (!mail || !password) {
      toast.error('Please enter your email and password.');
      return;
    }

    setBusy(true);
    try {
      const { error } = await signIn(mail, password);
      if (error) {
        toast.error('Incorrect email or password.');
        return;
      }
      if (await needsChallenge()) return;
      await finishSignIn();
    } catch (err) {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleResetRequest = async (e) => {
    e.preventDefault();
    if (!configured) {
      toast.error('Database is not configured yet. Contact the administrator.');
      return;
    }
    const mail = email.trim().toLowerCase();
    if (!mail || !isEmailValid(mail)) {
      toast.error('Please enter a valid email address.');
      return;
    }

    setResetBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(mail, {
        redirectTo: `${window.location.origin}/`,
      });
      if (error) {
        toast.error('Could not send the reset link. Please try again in a moment.');
        return;
      }
      setResetSent(true);
    } catch (err) {
      toast.error('Could not send the reset link. Please try again in a moment.');
    } finally {
      setResetBusy(false);
    }
  };

  const backToSignIn = () => {
    setMode('signin');
    setResetSent(false);
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    const code = mfaCode.trim();
    if (!/^\d{6}$/.test(code) || !mfaFactor || !mfaChallengeId) {
      toast.error('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setMfaBusy(true);
    try {
      await verifyChallenge(mfaFactor.id, mfaChallengeId, code);
      await finishSignIn();
    } catch (err) {
      toast.error('That code did not work. Please try the current code.');
      setMfaCode('');
      /* A failed verify consumes the challenge — start a fresh one. */
      try {
        await startChallenge(mfaFactor);
      } catch {
        /* leave the old challenge id; the retry will surface the error */
      }
      codeRef.current?.focus();
    } finally {
      setMfaBusy(false);
    }
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

          {session && !mfaFactor && !mfaGateFailed ? (
            <>
              <span className="spinner" aria-hidden="true" />
              <p className="login-card__sub">Loading...</p>
            </>
          ) : mfaFactor ? (
            <>
              <h1 className="login-card__title">Two-factor authentication</h1>
              <p className="login-card__sub">
                Enter the 6-digit code from your authenticator app to finish signing in.
              </p>

              <form className="login-form" onSubmit={handleMfaSubmit}>
                <div className="field">
                  <label htmlFor="login-code">Authentication code</label>
                  <input
                    ref={codeRef}
                    id="login-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="000000"
                    className="login-code-input"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  />
                </div>

                <button type="submit" className="btn btn--primary btn--block" disabled={mfaBusy}>
                  {mfaBusy ? (
                    <span className="btn__spinner" aria-hidden="true" />
                  ) : (
                    <>
                      <Icon name="lock" aria-hidden="true" />
                      Verify and sign in
                    </>
                  )}
                </button>
              </form>

              <div className="login-card__hint">
                <p className="login-card__hint-title">Lost your device?</p>
                <p className="login-card__hint-text">
                  Use one of your recovery codes, or ask an administrator to reset two-factor
                  authentication for this account.
                </p>
              </div>
            </>
          ) : mode === 'forgot' ? (
            resetSent ? (
              <>
                <h1 className="login-card__title">Check your inbox</h1>
                <p className="login-card__sub">
                  If an account exists for {email.trim()}, a link to set a new password is on its
                  way. Open it on this device — the link expires after a short time.
                </p>
                <button
                  type="button"
                  className="btn btn--primary btn--block"
                  onClick={backToSignIn}
                >
                  <Icon name="login" aria-hidden="true" />
                  Back to sign in
                </button>
                <p className="login-card__note">
                  Nothing arrived? Check the spam folder or ask an administrator.
                </p>
              </>
            ) : (
              <>
                <h1 className="login-card__title">Reset your password</h1>
                <p className="login-card__sub">
                  Enter your work email and we will send you a link to set a new password.
                </p>

                <form className="login-form" onSubmit={handleResetRequest}>
                  <div className="field">
                    <label htmlFor="login-reset-email">Email address</label>
                    <input
                      id="login-reset-email"
                      type="email"
                      autoComplete="username"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <button type="submit" className="btn btn--primary btn--block" disabled={resetBusy}>
                    {resetBusy ? (
                      <span className="btn__spinner" aria-hidden="true" />
                    ) : (
                      <>
                        <Icon name="login" aria-hidden="true" />
                        Send reset link
                      </>
                    )}
                  </button>
                </form>

                <button type="button" className="login-link login-link--block" onClick={backToSignIn}>
                  Back to sign in
                </button>
              </>
            )
          ) : (
            <>
              <h1 className="login-card__title">Sign in to your account</h1>
              <p className="login-card__sub">Sign in with your work email.</p>

              <form className="login-form" onSubmit={handleSubmit}>
                <div className="field">
                  <label htmlFor="login-email">Email address</label>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="username"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label htmlFor="login-password">Password</label>
                  <input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="login-link"
                    onClick={() => {
                      setMode('forgot');
                      setResetSent(false);
                    }}
                  >
                    Forgot password?
                  </button>
                </div>

                <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
                  {busy ? (
                    <span className="btn__spinner" aria-hidden="true" />
                  ) : (
                    <>
                      <Icon name="login" aria-hidden="true" />
                      Sign in
                    </>
                  )}
                </button>
              </form>

              <div className="login-card__hint">
                <p className="login-card__hint-title">Account access</p>
                <p className="login-card__hint-text">
                  Invoices are stored securely in the cloud under this account.
                  Use the work email and password your administrator gave you.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
