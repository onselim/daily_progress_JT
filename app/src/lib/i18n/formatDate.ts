import type { LanguageCode } from './languages';

// Chromium's bundled ICU data doesn't always include Georgian (`ka`/`ka-GE` are
// missing from `Intl.DateTimeFormat.supportedLocalesOf` on some builds, including the
// one used to render this project's PDF report) -- `toLocaleDateString('ka-GE', ...)`
// then silently falls back to English instead of throwing, so there's no runtime
// signal that it failed. Since Georgian is this project's actual pilot-project
// language, dates are hand-formatted here instead of trusting Intl for it.
const KA_WEEKDAYS_LONG = ['კვირა', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი'];
const KA_WEEKDAYS_SHORT = ['კვი', 'ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ'];
const KA_MONTHS = [
  'იანვარი',
  'თებერვალი',
  'მარტი',
  'აპრილი',
  'მაისი',
  'ივნისი',
  'ივლისი',
  'აგვისტო',
  'სექტემბერი',
  'ოქტომბერი',
  'ნოემბერი',
  'დეკემბერი',
];

// Same Intl-support gap as Georgian above -- Kurmanji (`ku`) isn't a locale Chromium's
// bundled ICU reliably carries either, so it's hand-formatted too rather than risking
// the same silent English fallback.
const KU_WEEKDAYS_LONG = ['Yekşem', 'Duşem', 'Sêşem', 'Çarşem', 'Pêncşem', 'În', 'Şemî'];
const KU_WEEKDAYS_SHORT = ['Yek', 'Du', 'Sê', 'Çar', 'Pên', 'În', 'Şem'];
const KU_MONTHS = [
  'Kanûna Paşîn',
  'Sibat',
  'Adar',
  'Nîsan',
  'Gulan',
  'Hezîran',
  'Tîrmeh',
  'Tebax',
  'Îlon',
  'Cotmeh',
  'Mijdar',
  'Kanûna Pêşîn',
];

const LOCALE_BY_LANG: Record<LanguageCode, string> = {
  en: 'en-GB',
  tr: 'tr-TR',
  ar: 'ar',
  ru: 'ru-RU',
  ka: 'ka-GE',
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
  ku: 'ku',
};

export function localeForLanguage(language: LanguageCode): string {
  return LOCALE_BY_LANG[language] ?? 'en-GB';
}

/** Full "Weekday, Day Month Year" format, e.g. for the report header date. */
export function formatLongDate(date: Date, language: LanguageCode): string {
  if (language === 'ka') {
    return `${KA_WEEKDAYS_LONG[date.getDay()]}, ${date.getDate()} ${KA_MONTHS[date.getMonth()]}, ${date.getFullYear()}`;
  }
  if (language === 'ku') {
    return `${KU_WEEKDAYS_LONG[date.getDay()]}, ${date.getDate()} ${KU_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  }
  return date.toLocaleDateString(localeForLanguage(language), {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Short weekday only, e.g. for the 5-day weather forecast row. */
export function formatShortWeekday(date: Date, language: LanguageCode): string {
  if (language === 'ka') return KA_WEEKDAYS_SHORT[date.getDay()];
  if (language === 'ku') return KU_WEEKDAYS_SHORT[date.getDay()];
  return date.toLocaleDateString(localeForLanguage(language), { weekday: 'short' });
}
