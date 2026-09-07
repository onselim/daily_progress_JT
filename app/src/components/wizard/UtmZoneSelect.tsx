import { useLanguage } from '../../lib/i18n/LanguageContext';

const ZONE_NUMBERS = Array.from({ length: 60 }, (_, i) => i + 1);

interface UtmZoneSelectProps {
  value: string;
  onChange: (value: string) => void;
}

/** Two dropdowns (zone number 1-60 + hemisphere) that combine into a UTM zone string like "38N". */
export function UtmZoneSelect({ value, onChange }: UtmZoneSelectProps) {
  const { t } = useLanguage();
  const match = value.trim().match(/^(\d{1,2})\s*([NnSs]?)$/);
  const zoneNumber = match ? match[1] : '';
  const hemisphere = match && match[2] ? match[2].toUpperCase() : 'N';

  return (
    <div className="wizard-form-row">
      <label>
        {t('wizard.utmZoneNumber')}
        <select value={zoneNumber} onChange={(e) => onChange(e.target.value ? `${e.target.value}${hemisphere}` : '')}>
          <option value="">{t('wizard.none')}</option>
          {ZONE_NUMBERS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('wizard.hemisphere')}
        <select value={hemisphere} onChange={(e) => onChange(zoneNumber ? `${zoneNumber}${e.target.value}` : '')}>
          <option value="N">{t('wizard.north')}</option>
          <option value="S">{t('wizard.south')}</option>
        </select>
      </label>
    </div>
  );
}
