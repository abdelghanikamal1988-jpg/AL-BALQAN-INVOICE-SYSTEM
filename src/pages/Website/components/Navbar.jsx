import { useState, useEffect } from 'react';
import { useLang } from '../../../context/LangContext.jsx';
import { useTheme } from '../../../context/ThemeContext.jsx';
import Icon from '../../../components/Icons/Icon.jsx';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { t, lang, toggleLang } = useLang();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className="ws-navbar" style={scrolled ? { background: 'rgba(29,53,94,0.95)', backdropFilter: 'blur(10px)' } : {}}>
      <div className="ws-navbar__inner">
        <div className="ws-navbar__brand">
          <img src="/logo.png" alt={t('website.brand')} className="ws-navbar__logo" />
        </div>

        <button
          className="ws-navbar__toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={t('website.nav.menuToggle')}
        >
          <span className={`ws-navbar__hamburger ${menuOpen ? 'open' : ''}`} />
        </button>

        <ul className={`ws-navbar__links ${menuOpen ? 'ws-navbar__links--open' : ''}`} style={scrolled ? {} : {}}>
          <li><a href="#home" onClick={() => setMenuOpen(false)}>{t('website.nav.home')}</a></li>
          <li><a href="#about" onClick={() => setMenuOpen(false)}>{t('website.nav.about')}</a></li>
          <li><a href="#services" onClick={() => setMenuOpen(false)}>{t('website.nav.services')}</a></li>
          <li><a href="#countries" onClick={() => setMenuOpen(false)}>{t('website.nav.countries')}</a></li>
          <li><a href="#contact" onClick={() => setMenuOpen(false)}>{t('website.nav.contact')}</a></li>
          <li>
            <button
              type="button"
              className="app-header__tool app-header__tool--lang"
              title={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
              aria-label={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
              onClick={toggleLang}
            >
              {lang === 'ar' ? 'EN' : 'ع'}
            </button>
          </li>
          <li>
            <button
              type="button"
              className="app-header__tool app-header__tool--theme"
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              onClick={toggleTheme}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
}
