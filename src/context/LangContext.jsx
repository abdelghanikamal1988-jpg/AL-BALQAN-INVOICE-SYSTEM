import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import en from '../i18n/en.js';
import ar from '../i18n/ar.js';
import { readPref, writePref, subscribeUserData } from '../lib/userData.js';

const DICTS = { en, ar };
const LangContext = createContext(null);

function normalize(value) {
  return value === 'ar' || value === 'en' ? value : 'en';
}

function readInitial() {
  return normalize(readPref('lang'));
}

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(readInitial);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  useEffect(
    () =>
      subscribeUserData(() => {
        const stored = normalize(readPref('lang'));
        setLangState((current) => (current === stored ? current : stored));
      }),
    [],
  );

  const t = useMemo(() => {
    const dict = DICTS[lang] || DICTS.en;
    return (key, vars) => {
      let text = dict[key];
      if (text === undefined) text = DICTS.en[key];
      if (text === undefined) return key;
      if (vars) {
        for (const name of Object.keys(vars)) {
          text = text.split(`{${name}}`).join(String(vars[name]));
        }
      }
      return text;
    };
  }, [lang]);

  const setLang = (next) => {
    const value = normalize(next);
    setLangState(value);
    writePref('lang', value);
  };

  const toggleLang = () => setLang(lang === 'ar' ? 'en' : 'ar');

  const value = useMemo(
    () => ({ lang, setLang, toggleLang, t, isRTL: lang === 'ar' }),
    [lang, t],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used inside LangProvider');
  return ctx;
}
