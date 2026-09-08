import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../components/Toast/ToastProvider.jsx';
import company from '../../data/company.js';
import { migrateLocalInvoices } from '../../utils/storage.js';

export default function Login() {
  const navigate = useNavigate();
  const toast = useToast();
  const { signIn, signUp, configured } = useAuth();

  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const switchMode = (next) => {
    setMode(next);
    setConfirm('');
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
    if (mode === 'signup' && password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (mode === 'signup' && password !== confirm) {
      toast.error('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await signIn(mail, password);
        if (error) {
          toast.error('Incorrect email or password.');
          return;
        }
        const migrated = await migrateLocalInvoices();
        if (migrated > 0) {
          toast.success(`${migrated} invoice${migrated > 1 ? 's were' : ' was'} migrated from this device.`);
        } else {
          toast.success('Welcome back.');
        }
        navigate('/');
      } else {
        const { data, error } = await signUp(mail, password);
        if (error) {
          toast.error(error.message || 'Sign up failed.');
          return;
        }
        if (data?.user && !data.session) {
          toast.success('Account created. Check your email to confirm, then sign in.');
          switchMode('signin');
        } else {
          toast.success('Account created. You are signed in.');
          navigate('/');
        }
      }
    } catch (err) {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <div className="card login-card">
        <div className="login-card__brand">
          <div className="login-card__logo">
            {company.logo ? (
              <img src={company.logo} alt="AL BALQAN logo" />
            ) : (
              <span className="login-card__logo-fallback">AB</span>
            )}
          </div>
          <h1>AL BALQAN</h1>
          <p className="login-card__tagline">Tourism &amp; Visa Services · Invoice System</p>
        </div>

        <div className="login-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            className={`login-tab${mode === 'signin' ? ' is-active' : ''}`}
            onClick={() => switchMode('signin')}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            className={`login-tab${mode === 'signup' ? ' is-active' : ''}`}
            onClick={() => switchMode('signup')}
          >
            Create Account
          </button>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
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
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {mode === 'signup' && (
            <div className="field">
              <label htmlFor="login-confirm">Confirm Password</label>
              <input
                id="login-confirm"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
          )}

          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy ? <span className="btn__spinner" aria-hidden="true" /> : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="login-card__note">
          Invoices are stored securely in the cloud under this account.
        </p>
      </div>
    </div>
  );
}