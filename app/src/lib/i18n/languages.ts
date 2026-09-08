export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'ar', label: 'العربية' },
  { code: 'ru', label: 'Русский' },
  { code: 'ka', label: 'ქართული' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'ku', label: 'Kurmancî' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export const RTL_LANGUAGES: ReadonlySet<LanguageCode> = new Set(['ar']);

export function isLanguageCode(value: string | null | undefined): value is LanguageCode {
  return !!value && LANGUAGES.some((l) => l.code === value);
}

/** The printed/emailed report can render more than one language in a single PDF (each
 * language gets its own page(s)) -- capped at 3 so the nightly report doesn't balloon
 * into an unreasonably long document. */
export const MAX_REPORT_LANGUAGES = 3;

/** Parses a comma-separated `?langs=en,tr,ka`-style list into valid, de-duplicated
 * language codes, capped at MAX_REPORT_LANGUAGES. Invalid/unknown codes are dropped
 * silently rather than breaking the whole report over one typo. */
export function parseLanguageList(value: string | null | undefined): LanguageCode[] {
  if (!value) return [];
  const seen = new Set<LanguageCode>();
  for (const raw of value.split(',')) {
    const code = raw.trim();
    if (isLanguageCode(code)) seen.add(code);
    if (seen.size >= MAX_REPORT_LANGUAGES) break;
  }
  return Array.from(seen);
}
