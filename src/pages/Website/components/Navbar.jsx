import { useState, useEffect } from 'react';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className="ws-navbar" style={scrolled ? { background: 'rgba(29,53,94,0.95)', backdropFilter: 'blur(10px)' } : {}}>
      <div className="ws-navbar__inner">
        <div className="ws-navbar__brand">
          <img src="/logo.png" alt="AL BALQAN" className="ws-navbar__logo" />
        </div>

        <button
          className="ws-navbar__toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span className={`ws-navbar__hamburger ${menuOpen ? 'open' : ''}`} />
        </button>

        <ul className={`ws-navbar__links ${menuOpen ? 'ws-navbar__links--open' : ''}`} style={scrolled ? {} : {}}>
          <li><a href="#home" onClick={() => setMenuOpen(false)}>Home</a></li>
          <li><a href="#about" onClick={() => setMenuOpen(false)}>About</a></li>
          <li><a href="#services" onClick={() => setMenuOpen(false)}>Services</a></li>
          <li><a href="#countries" onClick={() => setMenuOpen(false)}>Countries</a></li>
          <li><a href="#contact" onClick={() => setMenuOpen(false)}>Contact</a></li>
        </ul>
      </div>
    </nav>
  );
}
