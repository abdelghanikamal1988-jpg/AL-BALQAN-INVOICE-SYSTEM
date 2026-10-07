import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../components/Toast/ToastProvider.jsx';
import company from '../../data/company.js';
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
      <div className="card login-card">
        <div className="login-card__brand">
          <div className="login-card__logo">
            {company.logoUI ? (
              <img src={company.logoUI} alt="AL BALQAN logo" />
            ) : (
              <span className="login-card__logo-fallback">AB</span>
            )}
          </div>
          <p className="login-card__tagline">Tourism &amp; Visa Services · Invoice System</p>
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
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy ? <span className="btn__spinner" aria-hidden="true" /> : 'Sign In'}
          </button>
        </form>

        <p className="login-card__note">
          Invoices are stored securely in the cloud under this account.
        </p>
      </div>
    </div>
  );
}