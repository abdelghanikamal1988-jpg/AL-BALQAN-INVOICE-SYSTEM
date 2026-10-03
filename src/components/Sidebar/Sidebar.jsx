import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { userInitials } from '../../utils/userInitials.js';
import '../../styles/sidebar.css';

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function IconDashboard() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...STROKE}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.4" />
    </svg>
  );
}

function IconNewInvoice() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...STROKE}>
      <path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z" />
      <path d="M13.5 3v5.5H19" />
      <path d="M12 12.5v5M9.5 15h5" />
    </svg>
  );
}

function IconHistory() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...STROKE}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.4V12l3 1.8" />
    </svg>
  );
}

function IconNewClient() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...STROKE}>
      <path d="M14.5 20.5v-1.6a4 4 0 0 0-4-4H6.8a4 4 0 0 0-4 4v1.6" />
      <circle cx="9.2" cy="7.6" r="3.6" />
      <path d="M18.5 8.2v6M15.5 11.2h6" />
    </svg>
  );
}

function IconClients() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...STROKE}>
      <path d="M14.5 20.5v-1.6a4 4 0 0 0-4-4H6.3a4 4 0 0 0-4 4v1.6" />
      <circle cx="8.4" cy="7.6" r="3.6" />
      <path d="M17 4.4a3.6 3.6 0 0 1 0 6.4" />
      <path d="M21.7 20.5v-1.6a4 4 0 0 0-3-3.8" />
    </svg>
  );
}

function IconSignOut() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...STROKE}>
      <path d="M14.5 4H17a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2.5" />
      <path d="M9.5 8.2 6 12l3.5 3.8" />
      <path d="M6 12h8.5" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...STROKE}>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M3.5 19.5v-1.4a4 4 0 0 1 4-4h3a4 4 0 0 1 4 4v1.4" />
      <path d="M17.5 8.5v5M15 11h5" />
    </svg>
  );
}

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', Icon: IconDashboard, end: true, perm: 'page:dashboard' },
  { to: '/create', label: 'New Invoice', Icon: IconNewInvoice, perm: 'page:invoice.create' },
  { to: '/history', label: 'Invoice History', Icon: IconHistory, perm: 'page:invoice.history' },
  { to: '/clients/new', label: 'New Client', Icon: IconNewClient, end: true, perm: 'page:clients.new' },
  { to: '/clients', label: 'Clients History', Icon: IconClients, end: true, perm: 'page:clients' },
  { to: '/admin/users', label: 'Users', Icon: IconUsers, end: true, perm: 'page:admin' },
];

export default function Sidebar({ open = false, onClose }) {
  const { user, signOut, hasPerm } = useAuth();
  const items = NAV_ITEMS.filter((item) => hasPerm(item.perm));

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    const onResize = () => {
      if (window.innerWidth >= 768) onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <>
      <aside
        id="app-sidebar"
        className={`sidebar no-print${open ? ' is-open' : ''}`}
        aria-label="Primary"
      >
        <nav className="sidebar__nav" aria-label="Sections">
          {items.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={label}
              onClick={onClose}
              className={({ isActive }) => `sidebar__link${isActive ? ' is-active' : ''}`}
            >
              <span className="sidebar__icon">
                <Icon />
              </span>
              <span className="sidebar__label">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__foot">
          <button
            type="button"
            className="sidebar__link"
            title={`Sign Out${user ? ` — ${userInitials(user)}` : ''}`}
            onClick={() => {
              onClose();
              signOut();
            }}
          >
            <span className="sidebar__icon">
              <IconSignOut />
            </span>
            <span className="sidebar__label">Sign Out</span>
          </button>
        </div>
      </aside>
      {open && <div className="sidebar-backdrop" onClick={onClose} aria-hidden="true" />}
    </>
  );
}
