import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DEFAULT_LANGUAGE, RTL_LANGUAGES, isLanguageCode, parseLanguageList, type LanguageCode } from './languages';
import { localizeDigits } from './localizeDigits';
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
  /** Renders a number/count/percentage for display, switching to Arabic-Indic digits
   * when the current language is Arabic. Takes an already-formatted value (e.g.
   * `x.toFixed(1)` or `"12/34"`), not a raw number. */
  n: (value: string | number) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

/** Same lookup as the `t()` the context hands out, but as a plain function taking an
 * explicit language -- for the print report, which can render several languages'
 * worth of content in one page load and so can't rely on a single "current app
 * language" from context for all of it. */
export function translate(language: LanguageCode, key: TranslationKey, params?: TranslateParams): string {
  const dict = DICTIONARIES[language];
  const template = dict[key] ?? en[key] ?? key;
  return interpolate(template, params);
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
  // A print URL's `?lang=` or multi-language `?langs=` (set by the "Print PDF" button,
  // the nightly email's Browserless request, or a manually-built link) always wins on
  // first load -- Browserless renders a fresh, un-cached page per PDF, so localStorage
  // never applies there. For `?langs=`, the first listed language stands in as "the"
  // language for chrome outside the per-language report sheets (the toolbar button,
  // the page title) -- the sheets themselves render every requested language
  // regardless of this single value.
  const [searchParams] = useSearchParams();
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    const urlLang = searchParams.get('lang');
    if (isLanguageCode(urlLang)) return urlLang;
    const multi = parseLanguageList(searchParams.get('langs'));
    if (multi.length > 0) return multi[0];
    return readStoredLanguage();
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

  const t = useCallback((key: TranslationKey, params?: TranslateParams) => translate(language, key, params), [language]);

  const tLabel = useCallback((label: string | null | undefined) => translateConfigLabel(label, language), [language]);

  const n = useCallback((value: string | number) => localizeDigits(language, value), [language]);

  const value = useMemo(() => ({ language, setLanguage, t, tLabel, n }), [language, setLanguage, t, tLabel, n]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
