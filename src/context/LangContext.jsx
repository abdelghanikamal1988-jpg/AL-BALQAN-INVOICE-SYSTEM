import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import en from '../i18n/en.js';
import ar from '../i18n/ar.js';

const DICTS = { en, ar };
const LangContext = createContext(null);
const STORAGE_KEY = 'ab-lang';

function readInitial() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ar' || saved === 'en') return saved;
  } catch {
    /* storage unavailable */
  }
  return 'en';
}

export function LangProvider({ children }) {
  const [lang, setLang] = useState(readInitial);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* storage unavailable */
    }
  }, [lang]);

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

  const toggleLang = () => setLang((l) => (l === 'ar' ? 'en' : 'ar'));

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
