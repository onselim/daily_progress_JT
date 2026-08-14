const ZONE_NUMBERS = Array.from({ length: 60 }, (_, i) => i + 1);

interface UtmZoneSelectProps {
  value: string;
  onChange: (value: string) => void;
}

/** Two dropdowns (zone number 1-60 + hemisphere) that combine into a UTM zone string like "38N". */
export function UtmZoneSelect({ value, onChange }: UtmZoneSelectProps) {
  const match = value.trim().match(/^(\d{1,2})\s*([NnSs]?)$/);
  const zoneNumber = match ? match[1] : '';
  const hemisphere = match && match[2] ? match[2].toUpperCase() : 'N';

  return (
    <div className="wizard-form-row">
      <label>
        UTM zone number
        <select value={zoneNumber} onChange={(e) => onChange(e.target.value ? `${e.target.value}${hemisphere}` : '')}>
          <option value="">— none —</option>
          {ZONE_NUMBERS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label>
        Hemisphere
        <select value={hemisphere} onChange={(e) => onChange(zoneNumber ? `${zoneNumber}${e.target.value}` : '')}>
          <option value="N">North</option>
          <option value="S">South</option>
        </select>
      </label>
    </div>
  );
}
