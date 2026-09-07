import { useWeatherForecast } from '../lib/useWeatherForecast';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { formatShortWeekday } from '../lib/i18n/formatDate';

interface WeatherPanelProps {
  lat: number | null;
  lng: number | null;
}

export function WeatherPanel({ lat, lng }: WeatherPanelProps) {
  const { t, language } = useLanguage();
  const { days, error } = useWeatherForecast(lat, lng);

  if (lat == null || lng == null) return <p className="accordion-empty">{t('panels.noAssetLocation')}</p>;
  if (error) return <p className="accordion-empty">{error}</p>;
  if (!days) return <p className="accordion-empty">{t('panels.loadingForecast')}</p>;

  return (
    <>
      {days.map((d) => (
        <div key={d.date} className="weather-day-row">
          <span>{formatShortWeekday(new Date(`${d.date}T12:00:00`), language)}</span>
          <span>
            {d.tempMin}° / {d.tempMax}°
          </span>
          <span style={{ color: d.precipProbability > 50 ? '#ef4444' : '#00d4aa' }}>{d.precipProbability}%</span>
        </div>
      ))}
    </>
  );
}
