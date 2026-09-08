import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DEFAULT_LANGUAGE, RTL_LANGUAGES, isLanguageCode, type LanguageCode } from './languages';
import { en, type TranslationKey } from './translations/en';
import { tr } from './translations/tr';
import { ar } from './translations/ar';
import { ru } from './translations/ru';
import { ka } from './translations/ka';
import { fr } from './translations/fr';
import { de } from './translations/de';
import { es } from './translations/es';
import { ku } from './translations/ku';
import { translateConfigLabel } from './configLabelTranslations';

const DICTIONARIES: Record<LanguageCode, Record<TranslationKey, string>> = { en, tr, ar, ru, ka, fr, de, es, ku };

const STORAGE_KEY = 'app_language';

type TranslateParams = Record<string, string | number>;

interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (code: LanguageCode) => void;
  t: (key: TranslationKey, params?: TranslateParams) => string;
  /** Translates a work/design/supply item label or group name coming from
   * project_config (not app chrome) -- falls back to the original text unchanged
   * when there's no known translation. See configLabelTranslations.ts. */
  tLabel: (label: string | null | undefined) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

function readStoredLanguage(): LanguageCode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isLanguageCode(stored) ? stored : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // A print URL's `?lang=` (set by the "Print PDF" button or the nightly email's
  // Browserless request) always wins on first load -- Browserless renders a fresh,
  // un-cached page per PDF, so localStorage never applies there.
  const [searchParams] = useSearchParams();
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    const urlLang = searchParams.get('lang');
    return isLanguageCode(urlLang) ? urlLang : readStoredLanguage();
  });

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = RTL_LANGUAGES.has(language) ? 'rtl' : 'ltr';
  }, [language]);

  const setLanguage = useCallback((code: LanguageCode) => {
    setLanguageState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // Best-effort -- worst case the choice doesn't survive a reload.
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: TranslateParams) => {
      const dict = DICTIONARIES[language];
      const template = dict[key] ?? en[key] ?? key;
      return interpolate(template, params);
    },
    [language],
  );

  const tLabel = useCallback((label: string | null | undefined) => translateConfigLabel(label, language), [language]);

  const value = useMemo(() => ({ language, setLanguage, t, tLabel }), [language, setLanguage, t, tLabel]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
