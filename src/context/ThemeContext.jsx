import { createContext, useContext, useEffect, useState } from 'react';
import { readPref, writePref, subscribeUserData } from '../lib/userData.js';

const ThemeContext = createContext(null);

function normalize(value) {
  return value === 'dark' || value === 'light' ? value : 'light';
}

function readInitial() {
  return normalize(readPref('theme'));
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readInitial);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  }, [theme]);

  useEffect(
    () =>
      subscribeUserData(() => {
        const stored = normalize(readPref('theme'));
        setThemeState((current) => (current === stored ? current : stored));
      }),
    [],
  );

  const setTheme = (next) => {
    const value = normalize(next);
    setThemeState(value);
    writePref('theme', value);
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
