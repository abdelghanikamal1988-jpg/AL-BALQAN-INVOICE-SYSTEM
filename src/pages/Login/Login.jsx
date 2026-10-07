import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../components/Toast/ToastProvider.jsx';
import company from '../../data/company.js';
import Icon from '../../components/Icons/Icon.jsx';
import { migrateLocalInvoices } from '../../utils/storage.js';

export default function Login() {
  const navigate = useNavigate();
  const toast = useToast();
  const { signIn, configured } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

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
      const migrated = await migrateLocalInvoices();
      if (migrated > 0) {
        toast.success(`${migrated} invoice${migrated > 1 ? 's were' : ' was'} migrated from this device.`);
      } else {
        toast.success('Welcome back.');
      }
      navigate('/');
    } catch (err) {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-frame">
        <div className="login-brand">
          <span className="login-brand__tile">
            {company.logoUI ? (
              <img src={company.logoUI} alt="" />
            ) : (
              <span>AB</span>
            )}
          </span>
          <span className="login-brand__name">{company.shortName || 'AL BALQAN'}</span>
        </div>

        <div className="card login-card">
          <span className="login-card__strip" aria-hidden="true" />
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
        </div>
      </div>
    </div>
  );
}
