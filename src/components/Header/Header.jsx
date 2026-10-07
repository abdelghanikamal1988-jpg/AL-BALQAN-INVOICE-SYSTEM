import { NavLink } from 'react-router-dom';
import company from '../../data/company.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePendingApprovals } from '../../context/PendingApprovalsContext.jsx';
import Icon from '../Icons/Icon.jsx';
import { userInitials } from '../../utils/userInitials.js';

export default function Header({ menuOpen = false, onMenuToggle }) {
  const { user, hasPerm, isAdmin } = useAuth();
  const { count, openApprovals } = usePendingApprovals();

  return (
    <header className="app-header no-print">
      <div className="app-header__inner">
        <button
          type="button"
          className="app-header__menu"
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={menuOpen}
          aria-controls="app-sidebar"
          onClick={onMenuToggle}
        >
          <Icon name="menu" />
        </button>
        <NavLink to="/" className="app-header__brand" aria-label="AL BALQAN home">
          <span className="app-header__logo">
            {company.logoUI ? (
              <img src={company.logoUI} alt="AL BALQAN logo" />
            ) : (
              <span className="app-header__logo-fallback">AB</span>
            )}
          </span>
        </NavLink>

        <nav className="app-header__nav" aria-label="Primary">
          {hasPerm('page:dashboard') && (
            <NavLink to="/" className={({ isActive }) => `app-header__link${isActive ? ' is-active' : ''}`} end>
              Dashboard
            </NavLink>
          )}
          {hasPerm('page:invoice.create') && (
            <NavLink to="/create" className={({ isActive }) => `app-header__link${isActive ? ' is-active' : ''}`}>
              New Invoice
            </NavLink>
          )}
          {hasPerm('page:invoice.history') && (
            <NavLink to="/history" className={({ isActive }) => `app-header__link${isActive ? ' is-active' : ''}`}>
              Invoice History
            </NavLink>
          )}
          {hasPerm('page:clients') && (
            <NavLink to="/clients" className={({ isActive }) => `app-header__link${isActive ? ' is-active' : ''}`}>
              Clients
            </NavLink>
          )}
          {hasPerm('page:admin') && (
            <NavLink to="/admin/users" className={({ isActive }) => `app-header__link${isActive ? ' is-active' : ''}`}>
              Users
            </NavLink>
          )}
        </nav>

        <div className="app-header__right">
          {hasPerm('page:invoice.create') && (
            <NavLink to="/create" className="app-header__cta">
              New invoice
            </NavLink>
          )}
          {isAdmin && count > 0 && (
            <button
              type="button"
              className="app-header__bell"
              onClick={openApprovals}
              title={`${count} edit${count > 1 ? 's' : ''} waiting for your approval`}
              aria-label={`${count} edits waiting for your approval`}
            >
              <Icon name="bell" />
              <span className="app-header__bell-count" aria-hidden="true">
                {count > 9 ? '9+' : count}
              </span>
            </button>
          )}
          <span
            className="app-header__avatar"
            title={user?.email || 'Account'}
            aria-label={user?.email || 'Account'}
          >
            {userInitials(user)}
          </span>
        </div>
      </div>
    </header>
  );
}
