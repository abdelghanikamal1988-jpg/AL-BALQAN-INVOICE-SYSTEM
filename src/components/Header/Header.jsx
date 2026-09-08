import { NavLink } from 'react-router-dom';
import company from '../../data/company.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function Header() {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };
  return (
    <header className="app-header no-print">
      <div className="app-header__inner">
        <NavLink to="/" className="app-header__brand" aria-label="AL BALQAN home">
          <span className="app-header__logo">
            {company.logo ? (
              <img src={company.logo} alt="AL BALQAN logo" />
            ) : (
              <span className="app-header__logo-fallback">AB</span>
            )}
          </span>
          <span className="app-header__brand-text">
            <span className="app-header__name">AL BALQAN</span>
            <span className="app-header__tagline">Tourism &amp; Visa Services</span>
          </span>
        </NavLink>

        <nav className="app-header__nav" aria-label="Primary">
          <NavLink to="/" className={({ isActive }) => `app-header__link${isActive ? ' is-active' : ''}`} end>
            Dashboard
          </NavLink>
          <NavLink to="/create" className={({ isActive }) => `app-header__link${isActive ? ' is-active' : ''}`}>
            New Invoice
          </NavLink>
          <NavLink to="/history" className={({ isActive }) => `app-header__link${isActive ? ' is-active' : ''}`}>
            Invoice History
          </NavLink>
        </nav>

        <NavLink to="/create" className="btn btn--primary app-header__cta">
          + New Invoice
        </NavLink>
        <button type="button" className="btn app-header__signout" onClick={handleSignOut}>
          Sign Out
        </button>
      </div>
    </header>
  );
}
