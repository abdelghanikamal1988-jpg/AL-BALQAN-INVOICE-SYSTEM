import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import company from '../../data/company.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePendingApprovals } from '../../context/PendingApprovalsContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import Icon from '../Icons/Icon.jsx';
import { userInitials } from '../../utils/userInitials.js';
import { dbFetchClients } from '../../lib/clientRepo.js';
import { dbFetchAll } from '../../lib/invoiceRepo.js';
import { clientFullName, normalizePassport, filterClients } from '../../utils/clients.js';

export default function Header({ menuOpen = false, onMenuToggle }) {
  const { user, profile, hasPerm, isAdmin, signOut } = useAuth();
  const { count, openApprovals } = usePendingApprovals();
  const { t, lang, toggleLang } = useLang();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [q, setQ] = useState('');
  const [results, setResults] = useState({ clients: [], invoices: [] });
  const [searchOpen, setSearchOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [newOpen, setNewOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const innerRef = useRef(null);
  const inputRef = useRef(null);
  const dataRef = useRef(null);
  const timerRef = useRef(null);

  const canCreateInvoice = hasPerm('page:invoice.create');
  const canCreateClient = hasPerm('page:clients.new');

  const flat = useMemo(() => {
    const clientItems = results.clients.map((c) => ({
      key: `c-${c.id}`,
      to: `/clients/${c.id}`,
      title: clientFullName(c),
      subtitle: [normalizePassport(c.passport), c.country].filter(Boolean).join(' · '),
    }));
    const invoiceItems = results.invoices.map((inv) => ({
      key: `i-${inv.id}`,
      to: `/history?q=${encodeURIComponent(inv.invoiceNumber || '')}`,
      title: String(inv.invoiceNumber || t('shell.invoice')),
      subtitle: String(inv.customer || ''),
    }));
    return [...clientItems, ...invoiceItems];
  }, [results, t]);

  const closeAll = () => {
    setSearchOpen(false);
    setNewOpen(false);
    setUserMenuOpen(false);
  };

  const runSearch = async (text) => {
    const query = String(text || '').trim();
    if (query.length < 2) {
      setResults({ clients: [], invoices: [] });
      setSearchOpen(false);
      setActive(-1);
      return;
    }
    try {
      if (!dataRef.current) {
        const [clients, invoices] = await Promise.all([
          dbFetchClients().catch(() => []),
          dbFetchAll().catch(() => []),
        ]);
        dataRef.current = { clients: clients || [], invoices: invoices || [] };
      }
      const ql = query.toLowerCase();
      const clients = filterClients(dataRef.current.clients, query, '').slice(0, 6);
      const invoices = dataRef.current.invoices
        .filter(
          (inv) =>
            String(inv.invoiceNumber || '').toLowerCase().includes(ql) ||
            String(inv.customer || '').toLowerCase().includes(ql),
        )
        .slice(0, 5);
      setResults({ clients, invoices });
      setSearchOpen(true);
      setActive(-1);
    } catch {
      setResults({ clients: [], invoices: [] });
    }
  };

  const onSearchChange = (value) => {
    setQ(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => runSearch(value), 180);
  };

  const go = (item) => {
    if (!item) return;
    navigate(item.to);
    closeAll();
    setQ('');
    setResults({ clients: [], invoices: [] });
    if (inputRef.current) inputRef.current.blur();
  };

  const onSearchKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (flat.length ? (a + 1) % flat.length : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (flat.length ? (a <= 0 ? flat.length - 1 : a - 1) : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(flat[active >= 0 ? active : 0]);
    } else if (e.key === 'Escape') {
      closeAll();
      e.currentTarget.blur();
    }
  };

  const toggleFullscreen = () => {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    } catch {
      /* fullscreen not allowed — ignore */
    }
  };

  useEffect(() => {
    const onDocDown = (e) => {
      if (innerRef.current && !innerRef.current.contains(e.target)) closeAll();
    };
    const onDocKey = (e) => {
      if (e.key === 'Escape') closeAll();
      const t = e.target;
      const typing =
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable);
      if (e.key === '/' && !e.repeat && !typing && inputRef.current) {
        e.preventDefault();
        inputRef.current.focus();
      }
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onDocKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onDocKey);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const clientCount = results.clients.length;
  const displayName = profile?.full_name || (user?.email ? user.email.split('@')[0] : '');
  const roleLabel =
    profile?.role === 'admin'
      ? t('shell.role.admin')
      : profile?.role
        ? String(profile.role).replace(/^./, (m) => m.toUpperCase())
        : '';

  return (
    <header className="app-header no-print">
      <div className="app-header__inner" ref={innerRef}>
        <button
          type="button"
          className="app-header__menu"
          aria-label={menuOpen ? t('shell.closeNav') : t('shell.openNav')}
          aria-expanded={menuOpen}
          aria-controls="app-sidebar"
          onClick={onMenuToggle}
        >
          <Icon name="menu" />
        </button>
        <NavLink
          to="/"
          className="app-header__brand"
          aria-label={t('shell.brandHome', { brand: company.shortName || 'AL BALQAN' })}
        >
          <span className="app-header__logo">
            {company.logoUI ? (
              <img src={company.logoUI} alt={t('shell.logoAlt')} />
            ) : (
              <span className="app-header__logo-fallback">AB</span>
            )}
          </span>
          <span className="app-header__brand-word">{company.shortName || 'AL BALQAN'}</span>
        </NavLink>

        <form
          className="topsearch"
          role="search"
          onSubmit={(e) => e.preventDefault()}
          aria-label={t('shell.globalSearch')}
        >
          <span className="topsearch__addon" aria-hidden="true">
            <Icon name="search" />
          </span>
          <input
            ref={inputRef}
            type="search"
            className="topsearch__input"
            placeholder={t('shell.searchPlaceholder')}
            aria-label={t('shell.search')}
            autoComplete="off"
            spellCheck="false"
            role="combobox"
            aria-expanded={searchOpen}
            aria-autocomplete="list"
            value={q}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => q.trim().length >= 2 && setSearchOpen(true)}
            onKeyDown={onSearchKey}
          />
          {!q && (
            <kbd className="topsearch__hint" aria-hidden="true">
              /
            </kbd>
          )}
          {searchOpen && (
            <div className="topsearch__panel" role="listbox">
              {flat.length === 0 ? (
                <div className="topsearch__status">
                  {t('shell.noMatches', { q: q.trim() })}
                </div>
              ) : (
                <>
                  {clientCount > 0 && (
                    <div className="topsearch__group">
                      <div className="topsearch__heading">
                        <Icon name="users" />
                        <span>{t('shell.searchClients')}</span>
                      </div>
                      {flat.slice(0, clientCount).map((item, i) => (
                        <button
                          type="button"
                          key={item.key}
                          className={`topsearch__item${active === i ? ' is-active' : ''}`}
                          onMouseEnter={() => setActive(i)}
                          onClick={() => go(item)}
                        >
                          <span className="topsearch__title">{item.title}</span>
                          {item.subtitle && (
                            <span className="topsearch__subtitle">{item.subtitle}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {flat.length > clientCount && (
                    <div className="topsearch__group">
                      <div className="topsearch__heading">
                        <Icon name="receipt" />
                        <span>{t('shell.searchInvoices')}</span>
                      </div>
                      {flat.slice(clientCount).map((item, i) => (
                        <button
                          type="button"
                          key={item.key}
                          className={`topsearch__item${
                            active === clientCount + i ? ' is-active' : ''
                          }`}
                          onMouseEnter={() => setActive(clientCount + i)}
                          onClick={() => go(item)}
                        >
                          <span className="topsearch__title">{item.title}</span>
                          {item.subtitle && (
                            <span className="topsearch__subtitle">{item.subtitle}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="topsearch__footer">
                    <span>
                      <kbd>↑</kbd>
                      <kbd>↓</kbd> {t('shell.kbMove')}
                    </span>
                    <span>
                      <kbd>enter</kbd> {t('shell.kbOpen')}
                    </span>
                    <span>
                      <kbd>esc</kbd> {t('shell.kbClose')}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </form>

        <div className="app-header__right">
          {(canCreateInvoice || canCreateClient) && (
            <div className="app-header__dd">
              <button
                type="button"
                className="app-header__cta"
                aria-haspopup="menu"
                aria-expanded={newOpen}
                onClick={() => {
                  setNewOpen((o) => !o);
                  setUserMenuOpen(false);
                }}
              >
                <Icon name="plus" aria-hidden="true" />
                {t('shell.new')}
              </button>
              {newOpen && (
                <div className="dropdown-menu" role="menu">
                  {canCreateInvoice && (
                    <NavLink to="/create" className="dropdown-item" role="menuitem" onClick={closeAll}>
                      <Icon name="receipt" />
                      {t('shell.newInvoice')}
                    </NavLink>
                  )}
                  {canCreateClient && (
                    <NavLink
                      to="/clients/new"
                      className="dropdown-item"
                      role="menuitem"
                      onClick={closeAll}
                    >
                      <Icon name="user" />
                      {t('shell.newClient')}
                    </NavLink>
                  )}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            className="app-header__tool app-header__tool--lang"
            title={lang === 'ar' ? t('shell.switchToEnglish') : t('shell.switchToArabic')}
            aria-label={lang === 'ar' ? t('shell.switchToEnglish') : t('shell.switchToArabic')}
            onClick={toggleLang}
          >
            {lang === 'ar' ? 'EN' : 'ع'}
          </button>

          <button
            type="button"
            className="app-header__tool app-header__tool--theme"
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={toggleTheme}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>

          <button
            type="button"
            className="app-header__tool app-header__tool--wide"
            title={t('shell.toggleFullscreen')}
            aria-label={t('shell.toggleFullscreen')}
            onClick={toggleFullscreen}
          >
            <Icon name="maximize" />
          </button>

          {isAdmin && (
            <button
              type="button"
              className="app-header__bell"
              onClick={openApprovals}
              title={
                count > 0
                  ? t('shell.editsWaiting', { count, s: count > 1 ? 's' : '' })
                  : t('shell.notifications')
              }
              aria-label={
                count > 0 ? t('shell.editsWaiting', { count, s: 's' }) : t('shell.notifications')
              }
            >
              <Icon name="bell" />
              {count > 0 && (
                <span className="app-header__bell-count" aria-hidden="true">
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </button>
          )}

          <span className="app-header__vr" aria-hidden="true" />

          <div className="app-header__dd">
            <button
              type="button"
              className="app-header__user"
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              onClick={() => {
                setUserMenuOpen((o) => !o);
                setNewOpen(false);
              }}
            >
              <span className="app-header__avatar" aria-hidden="true">
                {userInitials(user)}
              </span>
              <span className="app-header__user-meta">
                <span className="app-header__uname">{displayName}</span>
                {roleLabel && <span className="app-header__urole">{roleLabel}</span>}
              </span>
              <Icon name="chevronDown" className="app-header__ucharv" aria-hidden="true" />
            </button>
            {userMenuOpen && (
              <div className="dropdown-menu dropdown-menu--end" role="menu">
                <button
                  type="button"
                  className="dropdown-item"
                  role="menuitem"
                  onClick={() => {
                    closeAll();
                    signOut();
                  }}
                >
                  <Icon name="logout" />
                  {t('shell.signOut')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
