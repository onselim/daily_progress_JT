export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'ar', label: 'العربية' },
  { code: 'ru', label: 'Русский' },
  { code: 'ka', label: 'ქართული' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export const RTL_LANGUAGES: ReadonlySet<LanguageCode> = new Set(['ar']);

export function isLanguageCode(value: string | null | undefined): value is LanguageCode {
  return !!value && LANGUAGES.some((l) => l.code === value);
}
