import type { LanguageCode } from './languages';

const ARABIC_INDIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/** Swaps Western digits (0-9) for Arabic-Indic digits (٠-٩) when `language` is Arabic,
 * leaving everything else in the string (., /, %, °, spaces, ...) untouched. Takes an
 * already-formatted value (e.g. the result of `.toFixed(1)`, or a "12/34" count) rather
 * than a raw number, since callers build these strings in many different shapes. */
export function localizeDigits(language: LanguageCode, value: string | number): string {
  const str = String(value);
  if (language !== 'ar') return str;
  return str.replace(/[0-9]/g, (d) => ARABIC_INDIC_DIGITS[Number(d)]);
}
