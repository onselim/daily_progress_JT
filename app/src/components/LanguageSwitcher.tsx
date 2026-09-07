import { useLanguage } from '../lib/i18n/LanguageContext';
import { LANGUAGES, isLanguageCode } from '../lib/i18n/languages';

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <select
      className="report-history-select language-switcher"
      value={language}
      onChange={(e) => {
        if (isLanguageCode(e.target.value)) setLanguage(e.target.value);
      }}
      title="Language"
    >
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
